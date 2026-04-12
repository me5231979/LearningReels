/**
 * Regenerate ALL existing reels with the new 5-card format:
 * hook → narration (What/Why/How) → scenario → interaction → feedback (+ micro-action)
 *
 * For each reel: delete old cards → call Claude → create new cards.
 * Preserves reel metadata (title, topic, bloom level, etc.) but gets fresh content.
 *
 * Usage:
 *   npx tsx scripts/regenerate-all-reels.ts              # regenerate all
 *   npx tsx scripts/regenerate-all-reels.ts --batch 50   # do 50 at a time
 *   npx tsx scripts/regenerate-all-reels.ts --dry        # dry run (count only)
 *   npx tsx scripts/regenerate-all-reels.ts --offset 100 # skip first 100
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

function getEnvVar(name: string): string {
  if (process.env[name]) return process.env[name]!;
  for (const f of [".env.local", ".env"]) {
    try {
      const content = readFileSync(join(process.cwd(), f), "utf-8");
      for (const line of content.split("\n")) {
        const m = line.match(new RegExp(`^${name}=['"]?([^'"\\s]+?)['"]?\\s*$`));
        if (m) return m[1];
      }
    } catch {}
  }
  throw new Error(`${name} not found`);
}

const SYSTEM_PROMPT = `You are a Vanderbilt University learning content architect. You create structured micro-learning experiences called "Learning Reels" — short, interactive, narrated experiences optimized for mobile delivery.

YOUR VOICE: Confident, clear, growth-oriented. You speak like a knowledgeable colleague, not a textbook. Use conversational tone. Address the learner as "you."

CRITICAL REQUIREMENTS:
- Each reel MUST be based on REAL, RELIABLE sources. Cite a SPECIFIC published article, research paper, or reputable resource.
- The sourceUrl MUST be a REAL, verifiable URL.
- The sourceCredit MUST name the specific author and publication.
- Each reel MUST align to exactly ONE Vanderbilt core competency:
  1. "Radically collaborates and cultivates belonging"
  2. "Embodies an entrepreneurial spirit and leverages data and technology"
  3. "Continuously strives for excellence"
  4. "Grows self and others"
  5. "Leads and inspires teams"
  6. "Develops and implements University strategy"
  7. "Makes effective and ethical decisions for the University"

CONTENT RESTRICTIONS:
- Practical professional skills only. NO health treatment, dangerous activities, alcohol/drugs, or deep abstract theory.
- Do not include DEI topics or inclusionist language.

VISUAL DESCRIPTION REQUIREMENTS:
- All visualDescription fields MUST depict Western society and culture exclusively.
- Settings must be modern American or Western European corporate or academic environments.

PEDAGOGICAL MODEL:
- Each reel is exactly 5 cards: hook → narration → scenario → interaction → feedback.

OUTPUT FORMAT — respond with JSON only, no markdown:
{
  "title": "string — max 60 chars",
  "summary": "string",
  "sourceUrl": "string — REAL URL",
  "sourceCredit": "string",
  "coreCompetency": "string — one of the 7",
  "coachPersona": {
    "role": "string",
    "expertise": "string",
    "openingQuestion": "string — concrete first question referencing THIS reel",
    "guardrails": "string"
  },
  "estimatedSeconds": number,
  "cards": [
    {
      "cardType": "hook" | "narration" | "scenario" | "interaction" | "feedback",
      "title": "string",
      "script": "string",
      "visualDescription": "string",
      "animationCue": "string",
      "quizJson": null | { "question": "string", "choices": ["a","b","c","d"], "correctIndex": number, "explanation": "string" },
      "scenarioJson": null | { "situation": "string", "choices": [{"label":"string","feedback":"string"},{"label":"string","feedback":"string"},{"label":"string","feedback":"string"}], "debrief": "string" },
      "durationMs": number
    }
  ]
}

CARD RULES (exactly 5 cards in this order):
1. Card 1 — "hook": Surprising fact, provocative question, or scenario. 40-60 words.
2. Card 2 — "narration": Core teaching. Script MUST use:
   **What** [Define the concept. 2-3 sentences.]
   **Why** [Why it matters. 2-3 sentences. Generic for all staff.]
   **How** [Concrete method to apply it. 2-3 sentences.]
   Total: 120-180 words depending on Bloom's level.
3. Card 3 — "scenario": Vanderbilt workplace "what would you do?" decision. scenarioJson with 3 plausible choices (no obviously wrong answers), feedback for each, and a debrief.
4. Card 4 — "interaction": Quiz with quizJson, 4 choices, one correct.
5. Card 5 — "feedback": Key takeaway. Script must end with: **Micro-Action:** [one specific thing to do within 24 hours.]`;

const BLOOMS: Record<string, { label: string; verb: string; description: string }> = {
  remember: { label: "Remember", verb: "Recall", description: "Retrieve relevant knowledge" },
  understand: { label: "Understand", verb: "Explain", description: "Construct meaning" },
  apply: { label: "Apply", verb: "Execute", description: "Carry out a procedure" },
  analyze: { label: "Analyze", verb: "Differentiate", description: "Break into parts" },
  evaluate: { label: "Evaluate", verb: "Judge", description: "Make judgments" },
  create: { label: "Create", verb: "Produce", description: "Put elements together" },
};

async function checkUrlAlive(url: string): Promise<string | null> {
  if (!url || !url.startsWith("http")) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    });
    clearTimeout(timeout);
    if (res.ok) return res.url || url;
    // Retry with GET for 403/405
    if (res.status === 403 || res.status === 405) {
      const c2 = new AbortController();
      const t2 = setTimeout(() => c2.abort(), 10000);
      const r2 = await fetch(url, { method: "GET", redirect: "follow", signal: c2.signal, headers: { "User-Agent": "Mozilla/5.0" } });
      clearTimeout(t2);
      if (r2.ok) return r2.url || url;
    }
    return null;
  } catch { return null; }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry");
  const batchIdx = args.indexOf("--batch");
  const batchSize = batchIdx >= 0 ? parseInt(args[batchIdx + 1]) || 50 : Infinity;
  const offsetIdx = args.indexOf("--offset");
  const offset = offsetIdx >= 0 ? parseInt(args[offsetIdx + 1]) || 0 : 0;

  const dbUrl = getEnvVar("DATABASE_URL");
  const apiKey = getEnvVar("ANTHROPIC_API_KEY");

  const adapter = new PrismaNeon({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });
  const anthropic = new Anthropic({ apiKey });

  try {
    const allReels = await prisma.learningReel.findMany({
      where: { status: { in: ["published", "draft"] } },
      include: { topic: true },
      orderBy: { createdAt: "asc" },
    });

    const reels = allReels.slice(offset, offset + batchSize);
    console.log(`\nTotal reels: ${allReels.length}`);
    console.log(`Processing: ${reels.length} (offset=${offset}, batch=${batchSize})`);
    if (dryRun) { console.log("DRY RUN — no changes.\n"); return; }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < reels.length; i++) {
      const reel = reels[i];
      const bloom = BLOOMS[reel.bloomLevel] || BLOOMS.understand;
      const num = offset + i + 1;

      console.log(`\n[${num}/${allReels.length}] "${reel.title}" (${reel.bloomLevel})`);

      const userPrompt = `Regenerate this Learning Reel with the new 5-card format.

EXISTING REEL:
- Title: "${reel.title}"
- Topic: "${reel.topic.label}" — ${reel.topic.description}
- Bloom's Level: ${bloom.label} — ${bloom.description}
- Core Competency: ${reel.coreCompetency || "assign the most relevant one"}
${reel.sourceCredit ? `- Original Source: ${reel.sourceCredit}` : ""}

BLOOM'S LEVEL: ${bloom.label}
Cognitive verb: "${bloom.verb}". Content and quiz must target this thinking level.

${bloom.label === "Remember" || bloom.label === "Understand" ? "NARRATION LENGTH: 120-150 words." : bloom.label === "Apply" || bloom.label === "Analyze" ? "NARRATION LENGTH: 150-180 words." : "NARRATION LENGTH: 170-200 words."}

Keep the same topic area but generate completely fresh content with the new 5-card structure:
hook → narration (What/Why/How) → scenario (Vanderbilt workplace decision) → interaction (quiz) → feedback (takeaway + micro-action).

Use a REAL source URL. Make the scenario specific to Vanderbilt staff.`;

      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        });

        const text = response.content[0]?.type === "text" ? response.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.log("  ❌ No JSON in response");
          failed++;
          continue;
        }

        const data = JSON.parse(jsonMatch[0]);
        if (!data.title || !Array.isArray(data.cards) || data.cards.length < 4) {
          console.log("  ❌ Invalid reel structure");
          failed++;
          continue;
        }

        // Validate sourceUrl
        let verifiedUrl: string | null = null;
        if (data.sourceUrl) {
          verifiedUrl = await checkUrlAlive(data.sourceUrl);
          if (!verifiedUrl) console.log(`  ⚠️  Dead sourceUrl: ${data.sourceUrl}`);
        }

        // Serialize coach persona
        let coachPersona: string | null = null;
        if (data.coachPersona) {
          const cp = data.coachPersona;
          const systemPrompt = `You are ${cp.role || "a practical learning coach"}.\n\n${cp.expertise || ""}\n\nGUARDRAILS: ${cp.guardrails || "Stay on topic."}`;
          coachPersona = JSON.stringify({ systemPrompt, openingQuestion: cp.openingQuestion || "What stood out to you from this reel?" });
        }

        // Delete old cards
        await prisma.reelCard.deleteMany({ where: { reelId: reel.id } });

        // Update reel metadata
        await prisma.learningReel.update({
          where: { id: reel.id },
          data: {
            title: data.title,
            summary: data.summary || reel.summary,
            sourceUrl: verifiedUrl,
            sourceCredit: data.sourceCredit || reel.sourceCredit,
            coreCompetency: data.coreCompetency || reel.coreCompetency,
            coachPersona: coachPersona || reel.coachPersona,
            contentJson: JSON.stringify(data),
          },
        });

        // Create new cards
        for (let j = 0; j < data.cards.length; j++) {
          const card = data.cards[j];
          await prisma.reelCard.create({
            data: {
              reelId: reel.id,
              order: j,
              cardType: card.cardType,
              title: card.title || "",
              script: card.script || "",
              visualDescription: card.visualDescription || "",
              animationCue: card.animationCue || null,
              quizJson: card.quizJson ? JSON.stringify(card.quizJson) : null,
              scenarioJson: card.scenarioJson ? JSON.stringify(card.scenarioJson) : null,
              durationMs: card.durationMs || 60000,
            },
          });
        }

        success++;
        console.log(`  ✅ "${data.title}" — ${data.cards.length} cards`);
      } catch (e) {
        console.error(`  ❌ Error:`, (e as Error).message);
        failed++;
      }

      // Rate limit: ~2 req/sec to stay well within Claude API limits
      if (i < reels.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("REGENERATION COMPLETE");
    console.log("=".repeat(60));
    console.log(`  ✅ Success: ${success}`);
    console.log(`  ❌ Failed:  ${failed}`);
    console.log(`  Total:     ${success + failed} / ${reels.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
