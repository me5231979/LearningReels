/**
 * Rewrite all published + draft reels at an 11th-grade reading level.
 *
 * Run:
 *   npx tsx scripts/rewrite-reels.ts                # full batch (published + draft)
 *   npx tsx scripts/rewrite-reels.ts --limit 1      # rewrite just one (dry-run)
 *   npx tsx scripts/rewrite-reels.ts --reel <id>    # rewrite one specific reel
 *   npx tsx scripts/rewrite-reels.ts --resume       # skip ids in progress file
 *
 * Progress is tracked in backups/rewrite-progress.json so the script is
 * fully resumable. Failures are recorded and skipped on the next run unless
 * you pass --retry-failed.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";

// ── DB setup ───────────────────────────────────────────────
const dbPath = path.join(__dirname, "..", "data", "learning-pall.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

// ── Anthropic setup ────────────────────────────────────────
function getApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const envPath = path.join(__dirname, "..", ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^ANTHROPIC_API_KEY=(.+)$/);
      if (match) return match[1].trim();
    }
  } catch {}
  throw new Error("ANTHROPIC_API_KEY not found");
}

const anthropic = new Anthropic({ apiKey: getApiKey() });
const MODEL = "claude-sonnet-4-20250514";

// ── Progress tracking ──────────────────────────────────────
const backupDir = path.join(__dirname, "..", "backups");
mkdirSync(backupDir, { recursive: true });
const progressPath = path.join(backupDir, "rewrite-progress.json");

type Progress = {
  startedAt: string;
  updatedAt: string;
  done: string[]; // reel ids successfully rewritten
  failed: Record<string, string>; // reel id → last error message
};

function loadProgress(): Progress {
  if (existsSync(progressPath)) {
    try {
      return JSON.parse(readFileSync(progressPath, "utf-8"));
    } catch {}
  }
  return {
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    done: [],
    failed: {},
  };
}

function saveProgress(p: Progress) {
  p.updatedAt = new Date().toISOString();
  writeFileSync(progressPath, JSON.stringify(p, null, 2), "utf-8");
}

// ── Types ──────────────────────────────────────────────────
type CardRewrite = {
  id: string;
  cardType: string;
  order: number;
  title: string;
  script: string;
  quizJson: null | {
    question: string;
    choices: string[];
    correctIndex: number;
    explanation: string;
  };
};

type ReelRewrite = {
  title: string;
  summary: string;
  cards: CardRewrite[];
  // Optional: rewritten coachPersona system prompt if present
  coachSystemPrompt?: string;
};

// ── Prompt builder ─────────────────────────────────────────
function buildPrompt(reel: {
  id: string;
  title: string;
  summary: string;
  bloomLevel: string;
  sourceCredit: string | null;
  sourceUrl: string | null;
  coreCompetency: string | null;
  topicLabel: string;
  coachSystemPrompt: string | null;
  cards: Array<{
    id: string;
    cardType: string;
    order: number;
    title: string;
    script: string;
    quizJson: string | null;
  }>;
}): string {
  const parsedCards = reel.cards.map((c) => ({
    id: c.id,
    order: c.order,
    cardType: c.cardType,
    title: c.title,
    script: c.script,
    quizJson: c.quizJson ? JSON.parse(c.quizJson) : null,
  }));

  return `You are rewriting a Vanderbilt University "Learning Reel" to be easier to read.

## READING-LEVEL TARGET
Rewrite every piece of text so a confident 11th-grade reader (Flesch-Kincaid grade level 9–11) can understand it on first read.

HOW TO GET THERE:
- Short sentences. Aim for an average of 12–17 words per sentence. Split long sentences.
- Use common words. Swap jargon and buzzwords for everyday language. If you must use a specialist term, define it once in plain English right after.
- Use active voice ("managers decide" not "decisions are made by managers").
- Prefer verbs over noun-phrases ("people choose" not "the selection process").
- Write like you're explaining it to a smart new-hire, not a textbook.
- Keep concrete examples; drop abstract hedging.
- Do NOT dumb down the content. Every concept, statistic, and action the original teaches must still be there. You are changing the *wording*, not the *meaning*.

## HARD RULES
1. Preserve the exact number of cards and their order. ${parsedCards.length} cards in, ${parsedCards.length} cards out.
2. Preserve each card's cardType and id. Return them unchanged.
3. For the interaction card's quizJson: keep the same number of choices and the same correctIndex. You may rewrite the question, each choice, and the explanation text.
4. Do NOT invent new statistics, studies, quotes, or author attributions. If the original cites Ken Blanchard or HBR, keep that citation. Do not add any you don't already see.
5. Do NOT mention DEI, diversity, equity, inclusion, inclusionist language, or related frameworks in any rewritten text.
6. Keep any proper nouns (Blanchard, Harvard Business Review, SLII, etc.) exactly as spelled.
7. Never use em-dashes. Replace them with a period, comma, or colon.
8. Do not add emoji.

## REEL CONTEXT (do NOT copy this into the output)
Topic: ${reel.topicLabel}
Bloom level: ${reel.bloomLevel}
Core competency: ${reel.coreCompetency ?? "(none)"}
Source credit: ${reel.sourceCredit ?? "(none)"}
Source URL: ${reel.sourceUrl ?? "(none)"}

## ORIGINAL REEL
Title: ${reel.title}
Summary: ${reel.summary}

Cards:
${parsedCards
  .map(
    (c) => `-- Card ${c.order} (${c.cardType}) id=${c.id} --
title: ${c.title}
script: ${c.script}
${c.quizJson ? `quizJson: ${JSON.stringify(c.quizJson, null, 2)}` : "quizJson: null"}`
  )
  .join("\n\n")}

${
  reel.coachSystemPrompt
    ? `## ORIGINAL COACH SYSTEM PROMPT
${reel.coachSystemPrompt}

Rewrite this system prompt too. Keep every rule, every guardrail, every reference to the reel topic and source. Only simplify the wording and sentence structure to the same 11th-grade target. Keep the "REEL:", "SUMMARY:", "TOPIC:", "BLOOM LEVEL:", "YOUR ROLE:", "VOICE:", "GUARDRAILS:" section labels. Return the result as coachSystemPrompt in the JSON.`
    : ""
}

## OUTPUT
Return ONLY a single JSON object. No preamble, no code fences, no trailing commentary. Shape:

{
  "title": "rewritten reel title",
  "summary": "rewritten 1-2 sentence summary",
  "cards": [
    {
      "id": "<original card id>",
      "cardType": "<original cardType>",
      "order": <original order>,
      "title": "rewritten card title",
      "script": "rewritten narration script",
      "quizJson": null  // OR for the interaction card: { "question": "...", "choices": ["...", "..."], "correctIndex": <same as original>, "explanation": "..." }
    }
    // ... one entry per original card, same order
  ]${reel.coachSystemPrompt ? `,\n  "coachSystemPrompt": "rewritten system prompt"` : ""}
}`;
}

// ── Claude call ────────────────────────────────────────────
async function rewriteOneReel(reel: Parameters<typeof buildPrompt>[0]): Promise<ReelRewrite> {
  const prompt = buildPrompt(reel);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text block in Claude response");
  }

  let raw = textBlock.text.trim();
  // Strip possible code fences
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }

  let parsed: ReelRewrite;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // Try to recover: find first { and last }
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first >= 0 && last > first) {
      parsed = JSON.parse(raw.slice(first, last + 1));
    } else {
      throw new Error(`Failed to parse JSON from Claude: ${(e as Error).message}`);
    }
  }

  // Validate shape
  if (typeof parsed.title !== "string" || typeof parsed.summary !== "string") {
    throw new Error("Missing title/summary in rewrite");
  }
  if (!Array.isArray(parsed.cards) || parsed.cards.length !== reel.cards.length) {
    throw new Error(
      `Card count mismatch: expected ${reel.cards.length}, got ${parsed.cards?.length}`
    );
  }

  // Map rewritten cards by id (not order) to be safe
  const origById = new Map(reel.cards.map((c) => [c.id, c]));
  for (const rc of parsed.cards) {
    const orig = origById.get(rc.id);
    if (!orig) throw new Error(`Rewrite returned unknown card id ${rc.id}`);
    if (rc.cardType !== orig.cardType) {
      throw new Error(`Card ${rc.id} cardType changed ${orig.cardType} → ${rc.cardType}`);
    }
    if (typeof rc.title !== "string" || typeof rc.script !== "string") {
      throw new Error(`Card ${rc.id} missing title or script`);
    }
    if (orig.quizJson) {
      const origQuiz = JSON.parse(orig.quizJson);
      if (!rc.quizJson) throw new Error(`Card ${rc.id} dropped quizJson`);
      if (rc.quizJson.correctIndex !== origQuiz.correctIndex) {
        throw new Error(
          `Card ${rc.id} correctIndex changed ${origQuiz.correctIndex} → ${rc.quizJson.correctIndex}`
        );
      }
      if (rc.quizJson.choices?.length !== origQuiz.choices?.length) {
        throw new Error(
          `Card ${rc.id} choice count changed ${origQuiz.choices?.length} → ${rc.quizJson.choices?.length}`
        );
      }
    }
  }

  return parsed;
}

// ── Write back to DB ───────────────────────────────────────
async function applyRewrite(
  reelId: string,
  reel: {
    contentJson: string;
    coachPersona: string | null;
    cards: Array<{
      id: string;
      cardType: string;
      order: number;
      quizJson: string | null;
    }>;
  },
  rewrite: ReelRewrite
) {
  // Rebuild contentJson with rewritten top-level + card fields,
  // preserving visualDescription, animationCue, durationMs, sourceUrl, sourceCredit,
  // coreCompetency, estimatedSeconds.
  const origContent = JSON.parse(reel.contentJson);
  const origCardsByIndex = Array.isArray(origContent.cards) ? origContent.cards : [];

  const rewriteById = new Map(rewrite.cards.map((c) => [c.id, c]));
  // For contentJson we need to match rewritten cards back to their position.
  // The DB cards have ids; contentJson cards don't. Match by order/cardType.
  const dbCardsByOrder = [...reel.cards].sort((a, b) => a.order - b.order);

  const newContentCards = dbCardsByOrder.map((dbCard, idx) => {
    const rw = rewriteById.get(dbCard.id);
    if (!rw) throw new Error(`No rewrite for card ${dbCard.id}`);
    const origCard = origCardsByIndex[idx] ?? {};
    return {
      ...origCard,
      cardType: dbCard.cardType,
      title: rw.title,
      script: rw.script,
      quizJson: rw.quizJson ?? null,
    };
  });

  const newContent = {
    ...origContent,
    title: rewrite.title,
    summary: rewrite.summary,
    cards: newContentCards,
  };

  // Rewritten coachPersona if returned
  let newCoachPersona = reel.coachPersona;
  if (rewrite.coachSystemPrompt && reel.coachPersona) {
    try {
      const parsed = JSON.parse(reel.coachPersona);
      parsed.systemPrompt = rewrite.coachSystemPrompt;
      newCoachPersona = JSON.stringify(parsed);
    } catch {
      // coachPersona may be plain string in a few cases
      newCoachPersona = rewrite.coachSystemPrompt;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.learningReel.update({
      where: { id: reelId },
      data: {
        title: rewrite.title,
        summary: rewrite.summary,
        contentJson: JSON.stringify(newContent),
        coachPersona: newCoachPersona,
      },
    });
    for (const rw of rewrite.cards) {
      const dbCard = reel.cards.find((c) => c.id === rw.id);
      if (!dbCard) continue;
      await tx.reelCard.update({
        where: { id: rw.id },
        data: {
          title: rw.title,
          script: rw.script,
          quizJson: rw.quizJson ? JSON.stringify(rw.quizJson) : null,
        },
      });
    }
  });
}

// ── Main ───────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const out: { limit?: number; reelId?: string; resume?: boolean; retryFailed?: boolean } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--limit") out.limit = parseInt(args[++i], 10);
    else if (a === "--reel") out.reelId = args[++i];
    else if (a === "--resume") out.resume = true;
    else if (a === "--retry-failed") out.retryFailed = true;
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const progress = loadProgress();

  const where: any = { status: { in: ["published", "draft"] } };
  if (args.reelId) where.id = args.reelId;

  const reels = await prisma.learningReel.findMany({
    where,
    include: {
      cards: { orderBy: { order: "asc" } },
      topic: { select: { label: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  // Filter to what's not done
  const doneSet = new Set(progress.done);
  const failedSet = new Set(Object.keys(progress.failed));
  const targets = reels.filter((r) => {
    if (doneSet.has(r.id)) return false;
    if (failedSet.has(r.id) && !args.retryFailed) return false;
    return true;
  });

  const toProcess = args.limit ? targets.slice(0, args.limit) : targets;

  console.log(
    `Total matching reels: ${reels.length}. Already done: ${progress.done.length}. Previously failed: ${Object.keys(progress.failed).length}. Processing: ${toProcess.length}.`
  );
  if (toProcess.length === 0) {
    console.log("Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  let ok = 0;
  let fail = 0;
  const startTs = Date.now();

  for (let i = 0; i < toProcess.length; i++) {
    const r = toProcess[i];
    const prefix = `[${i + 1}/${toProcess.length}] ${r.id}`;
    console.log(`${prefix} ⟳ ${r.title.slice(0, 60)}`);

    try {
      // Extract coach system prompt if present
      let coachSystemPrompt: string | null = null;
      if (r.coachPersona) {
        try {
          const parsed = JSON.parse(r.coachPersona);
          coachSystemPrompt = typeof parsed.systemPrompt === "string" ? parsed.systemPrompt : null;
        } catch {
          coachSystemPrompt = r.coachPersona;
        }
      }

      const rewrite = await rewriteOneReel({
        id: r.id,
        title: r.title,
        summary: r.summary,
        bloomLevel: r.bloomLevel,
        sourceCredit: r.sourceCredit,
        sourceUrl: r.sourceUrl,
        coreCompetency: r.coreCompetency,
        topicLabel: r.topic.label,
        coachSystemPrompt,
        cards: r.cards.map((c) => ({
          id: c.id,
          cardType: c.cardType,
          order: c.order,
          title: c.title,
          script: c.script,
          quizJson: c.quizJson,
        })),
      });

      await applyRewrite(
        r.id,
        {
          contentJson: r.contentJson,
          coachPersona: r.coachPersona,
          cards: r.cards.map((c) => ({
            id: c.id,
            cardType: c.cardType,
            order: c.order,
            quizJson: c.quizJson,
          })),
        },
        rewrite
      );

      progress.done.push(r.id);
      delete progress.failed[r.id];
      saveProgress(progress);
      ok++;

      const elapsed = (Date.now() - startTs) / 1000;
      const avg = elapsed / (i + 1);
      const remaining = Math.round(avg * (toProcess.length - i - 1));
      console.log(
        `${prefix} ✓ ok=${ok} fail=${fail} avg=${avg.toFixed(1)}s eta=${Math.floor(remaining / 60)}m${remaining % 60}s`
      );
    } catch (e) {
      fail++;
      const msg = (e as Error).message ?? String(e);
      progress.failed[r.id] = msg;
      saveProgress(progress);
      console.log(`${prefix} ✗ FAILED: ${msg}`);
    }

    // gentle pacing to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  console.log(`\nDONE. ok=${ok} fail=${fail}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
