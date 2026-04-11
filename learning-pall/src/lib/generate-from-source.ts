/**
 * Generate a Learning Reel from a source body of text (uploaded file, URL
 * scrape, or pasted text). Reels created via this path go directly to "draft"
 * status — admin must review and explicitly publish before learners see them.
 */
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "./db";
import { getAnthropicClient } from "./claude";
import {
  REEL_SYSTEM_PROMPT,
  buildReelUserPrompt,
} from "./prompts/reel-generation";
import type { BloomsLevel } from "@/types/course";
import { renderBrandedPdf } from "./pdf/branded";
import Database from "better-sqlite3";
import { existsSync } from "fs";
import { serializeTargetDepartments } from "./departments";
import { serializeCoachPersona, type GeneratedCoachPersona } from "./coach";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const SOURCES_DIR = path.join(UPLOADS_ROOT, "sources");
const ORIGINALS_DIR = path.join(UPLOADS_ROOT, "originals");
const SNAPSHOTS_DIR = path.join(UPLOADS_ROOT, "snapshots");

function getRawDb() {
  const candidates = [
    path.join(process.cwd(), "data", "learning-pall.db"),
    path.join(process.cwd(), "learning-pall", "data", "learning-pall.db"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return new Database(p);
  }
  throw new Error("learning-pall.db not found");
}

export type GenerateFromSourceInput = {
  topicId: string;
  bloomLevel: BloomsLevel;
  body: string;
  titleHint?: string;
  sourceType: "upload" | "url" | "text";
  sourceLabel: string; // filename, URL, or "Pasted text"
  generatedById: string;
  generatedByName: string;
  targetDepartments?: string[]; // empty/undefined = ALL STAFF
  // Optional file artifacts to archive alongside the branded PDF
  originalBuffer?: Buffer;
  originalFilename?: string;
  snapshotPdfBuffer?: Buffer;
  originalUrl?: string;
};

export type GenerateFromSourceResult = {
  reelId: string;
  title: string;
};

const MAX_BODY_CHARS = 30_000;

export async function generateReelFromSource(
  input: GenerateFromSourceInput
): Promise<GenerateFromSourceResult> {
  const topic = await prisma.topic.findUnique({ where: { id: input.topicId } });
  if (!topic) throw new Error("Topic not found");

  await fs.mkdir(SOURCES_DIR, { recursive: true });
  await fs.mkdir(ORIGINALS_DIR, { recursive: true });
  await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });

  // Trim body to a reasonable budget for the model
  const trimmed = input.body.length > MAX_BODY_CHARS
    ? input.body.slice(0, MAX_BODY_CHARS) + "\n\n[truncated]"
    : input.body;

  const userPrompt =
    buildReelUserPrompt(
      input.titleHint || topic.label,
      input.bloomLevel,
      topic.description
    ) +
    `\n\nUSE THE FOLLOWING SOURCE MATERIAL VERBATIM AS YOUR PRIMARY EVIDENCE. Do not invent facts or quotes that aren't grounded in this material. If the title hint differs, prefer the source's actual subject matter.\n\nSOURCE LABEL: ${input.sourceLabel}\n\n--- BEGIN SOURCE ---\n${trimmed}\n--- END SOURCE ---`;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2500,
    system: REEL_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude response did not contain a JSON object");
  }

  let reelData: {
    title: string;
    summary?: string;
    sourceUrl?: string;
    sourceCredit?: string;
    coreCompetency?: string;
    coachPersona?: GeneratedCoachPersona;
    estimatedSeconds?: number;
    cards: Array<{
      cardType: string;
      title?: string;
      script?: string;
      visualDescription?: string;
      animationCue?: string | null;
      quizJson?: unknown;
      durationMs?: number;
    }>;
  };
  try {
    reelData = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error("Failed to parse Claude JSON: " + (e as Error).message);
  }

  if (!reelData.title || !Array.isArray(reelData.cards) || reelData.cards.length === 0) {
    throw new Error("Reel JSON missing title or cards");
  }

  const coachPersona = serializeCoachPersona(reelData.coachPersona ?? null, {
    reelTitle: reelData.title,
    reelSummary: reelData.summary || "",
    topicLabel: topic.label,
    coreCompetency: reelData.coreCompetency || null,
    sourceCredit: reelData.sourceCredit || null,
    sourceUrl: input.originalUrl || reelData.sourceUrl || null,
    bloomLevel: input.bloomLevel,
  });

  // Create the reel as DRAFT — admin must approve before learners see it.
  const reel = await prisma.learningReel.create({
    data: {
      topicId: topic.id,
      title: reelData.title,
      summary: reelData.summary || "",
      bloomLevel: input.bloomLevel,
      estimatedSeconds: reelData.estimatedSeconds || 240,
      contentJson: JSON.stringify(reelData),
      sourceUrl: input.originalUrl || reelData.sourceUrl || null,
      sourceCredit: reelData.sourceCredit || null,
      coachPersona,
      targetDepartments: serializeTargetDepartments(input.targetDepartments),
      status: "draft",
      createdById: input.generatedById,
    },
  });

  for (let j = 0; j < reelData.cards.length; j++) {
    const card = reelData.cards[j];
    await prisma.reelCard.create({
      data: {
        reelId: reel.id,
        order: j,
        cardType: card.cardType,
        title: card.title || "",
        script: card.script || "",
        visualDescription: card.visualDescription || "",
        animationCue: (card.animationCue as string) || null,
        quizJson: card.quizJson ? JSON.stringify(card.quizJson) : null,
        durationMs: card.durationMs || 60000,
      },
    });
  }

  // Render & archive the branded source PDF
  const brandedPath = path.join(SOURCES_DIR, `${reel.id}-branded.pdf`);
  const brandedBuf = await renderBrandedPdf({
    reelTitle: reel.title,
    topic: topic.label,
    bloomLevel: input.bloomLevel,
    generatedAt: new Date(),
    generatedBy: input.generatedByName,
    sourceType: input.sourceType,
    sourceLabel: input.sourceLabel,
    body: input.body,
    summary: reelData.summary,
  });
  await fs.writeFile(brandedPath, brandedBuf);

  let originalPath: string | null = null;
  if (input.originalBuffer && input.originalFilename) {
    const safeName = input.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    originalPath = path.join(ORIGINALS_DIR, `${reel.id}-${safeName}`);
    await fs.writeFile(originalPath, input.originalBuffer);
  }

  let snapshotPath: string | null = null;
  if (input.snapshotPdfBuffer) {
    snapshotPath = path.join(SNAPSHOTS_DIR, `${reel.id}-snapshot.pdf`);
    await fs.writeFile(snapshotPath, input.snapshotPdfBuffer);
  }

  // Insert ReelSource via raw SQL — Prisma client may not have been regenerated
  // since the schema added the model.
  try {
    const db = getRawDb();
    db.prepare(
      `INSERT INTO ReelSource (id, reelId, sourceType, originalName, originalUrl, originalPath, brandedPdfPath, snapshotPdfPath, extractedText, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `cs_${Math.random().toString(36).slice(2, 12)}`,
      reel.id,
      input.sourceType,
      input.originalFilename || null,
      input.originalUrl || null,
      originalPath,
      brandedPath,
      snapshotPath,
      input.body,
      new Date().toISOString()
    );
    db.close();
  } catch (e) {
    console.error("Failed to insert ReelSource row:", e);
  }

  return { reelId: reel.id, title: reel.title };
}
