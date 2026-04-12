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
import { serializeTargetDepartments } from "./departments";
import { serializeCoachPersona, type GeneratedCoachPersona } from "./coach";
import { checkUrlAlive } from "./url-check";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const SOURCES_DIR = path.join(UPLOADS_ROOT, "sources");
const ORIGINALS_DIR = path.join(UPLOADS_ROOT, "originals");
const SNAPSHOTS_DIR = path.join(UPLOADS_ROOT, "snapshots");

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

  // Best-effort: writable on local dev, silently no-op on Vercel's read-only FS.
  const canWriteUploads = await tryMkdirs([SOURCES_DIR, ORIGINALS_DIR, SNAPSHOTS_DIR]);

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
      scenarioJson?: unknown;
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

  // Validate the source URL before persisting
  const candidateUrl = input.originalUrl || reelData.sourceUrl || null;
  let verifiedUrl: string | null = null;
  if (candidateUrl) {
    verifiedUrl = await checkUrlAlive(candidateUrl);
    if (!verifiedUrl) {
      console.warn(`[generate-from-source] dead sourceUrl for "${reelData.title}": ${candidateUrl}`);
    }
  }

  // Create the reel as DRAFT — admin must approve before learners see it.
  const reel = await prisma.learningReel.create({
    data: {
      topicId: topic.id,
      title: reelData.title,
      summary: reelData.summary || "",
      bloomLevel: input.bloomLevel,
      estimatedSeconds: reelData.estimatedSeconds || 240,
      contentJson: JSON.stringify(reelData),
      sourceUrl: verifiedUrl,
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
          scenarioJson: card.scenarioJson ? JSON.stringify(card.scenarioJson) : null,
        durationMs: card.durationMs || 60000,
      },
    });
  }

  // Render & archive the branded source PDF. On Vercel these writes fail
  // (read-only FS) so we treat them as best-effort and still save the reel.
  let brandedPath: string | null = null;
  let originalPath: string | null = null;
  let snapshotPath: string | null = null;

  if (canWriteUploads) {
    try {
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
      const p = path.join(SOURCES_DIR, `${reel.id}-branded.pdf`);
      await fs.writeFile(p, brandedBuf);
      brandedPath = p;
    } catch (e) {
      console.warn("[generate-from-source] branded PDF archive skipped:", (e as Error).message);
    }

    if (input.originalBuffer && input.originalFilename) {
      try {
        const safeName = input.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const p = path.join(ORIGINALS_DIR, `${reel.id}-${safeName}`);
        await fs.writeFile(p, input.originalBuffer);
        originalPath = p;
      } catch (e) {
        console.warn("[generate-from-source] original archive skipped:", (e as Error).message);
      }
    }

    if (input.snapshotPdfBuffer) {
      try {
        const p = path.join(SNAPSHOTS_DIR, `${reel.id}-snapshot.pdf`);
        await fs.writeFile(p, input.snapshotPdfBuffer);
        snapshotPath = p;
      } catch (e) {
        console.warn("[generate-from-source] snapshot archive skipped:", (e as Error).message);
      }
    }
  }

  try {
    await prisma.reelSource.create({
      data: {
        reelId: reel.id,
        sourceType: input.sourceType,
        originalName: input.originalFilename || null,
        originalUrl: input.originalUrl || null,
        originalPath,
        brandedPdfPath: brandedPath ?? "",
        snapshotPdfPath: snapshotPath,
        extractedText: input.body,
      },
    });
  } catch (e) {
    console.error("Failed to insert ReelSource row:", e);
  }

  return { reelId: reel.id, title: reel.title };
}

async function tryMkdirs(dirs: string[]): Promise<boolean> {
  try {
    for (const d of dirs) {
      await fs.mkdir(d, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}
