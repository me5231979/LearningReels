import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAnthropicClient } from "@/lib/claude";
import { serializeCoachPersona, type GeneratedCoachPersona } from "@/lib/coach";
import { checkUrlAlive } from "@/lib/url-check";

type BloomLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
// 3-reel sequence: foundational → application → analysis. Deeper levels are
// covered by the optional "Dive Deeper" flow at the end of the feed.
const DISTRIBUTION: [BloomLevel, number][] = [
  ["understand", 1],
  ["apply", 1],
  ["analyze", 1],
];

const BLOOMS: Record<BloomLevel, { label: string; verb: string; description: string }> = {
  remember: { label: "Remember", verb: "Recall", description: "Retrieve relevant knowledge from long-term memory" },
  understand: { label: "Understand", verb: "Explain", description: "Construct meaning from instructional messages" },
  apply: { label: "Apply", verb: "Execute", description: "Carry out or use a procedure in a given situation" },
  analyze: { label: "Analyze", verb: "Differentiate", description: "Break material into parts and determine relationships" },
  evaluate: { label: "Evaluate", verb: "Judge", description: "Make judgments based on criteria and standards" },
  create: { label: "Create", verb: "Produce", description: "Put elements together to form a coherent whole" },
};

const SYSTEM_PROMPT = `You are a Vanderbilt University learning content architect. You create structured micro-learning experiences called "Learning Reels" — short, interactive, narrated experiences optimized for mobile delivery.

YOUR VOICE: Confident, clear, growth-oriented. You speak like a knowledgeable colleague, not a textbook. Use conversational tone. Address the learner as "you."

CRITICAL REQUIREMENTS:
- Each reel MUST be based on REAL, RELIABLE online sources you know about. Cite a SPECIFIC published article, research paper, or reputable resource.
- The sourceUrl MUST be a REAL, verifiable URL (Harvard Business Review, MIT Sloan, McKinsey, peer-reviewed research, reputable practitioner publications, etc.).
- The sourceCredit MUST name the specific author and publication.
- Do NOT make up generic content — reference real frameworks, real research, real statistics.
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
- Settings must be modern American or Western European: corporate offices, university campuses, conference rooms, professional workplaces.
- People, attire, architecture, and cultural references must reflect contemporary Western (US, Canada, UK, Western Europe) corporate or academic life.
- Do NOT describe East Asian, Middle Eastern, South Asian, or non-Western settings or cultural elements.

PEDAGOGICAL MODEL:
- Each reel is 4 cards: hook → narration → interaction → feedback.
- Apply Keller's ARCS: hook with attention, build relevance, build confidence, deliver satisfaction.
- Include a retrieval-practice quiz in the interaction card.

OUTPUT FORMAT — respond with JSON only, no markdown:
{
  "title": "string — reel title, max 60 chars",
  "summary": "string — one-sentence summary",
  "sourceUrl": "string — REAL URL to a specific reputable article or research page",
  "sourceCredit": "string — e.g. 'Harvard Business Review, by Amy Edmondson'",
  "coreCompetency": "string — exactly one of the 7 Vanderbilt core competencies",
  "coachPersona": {
    "role": "string — who the reel's Coach chatbot is",
    "expertise": "string — what the coach knows, grounded in this reel's source",
    "openingQuestion": "string — a concrete first question that references something from THIS reel",
    "guardrails": "string — stay on topic; refuse off-topic, DEI, health, drugs, abstract theory"
  },
  "estimatedSeconds": number,
  "cards": [
    {
      "cardType": "hook" | "narration" | "interaction" | "feedback",
      "title": "string",
      "script": "string — 60-120 words, conversational",
      "visualDescription": "string — what the visual should depict",
      "animationCue": "string — 'reveal' | 'diagram' | 'chart' | 'process' | 'comparison'",
      "quizJson": null | { "question": "string", "choices": ["a","b","c","d"], "correctIndex": number, "explanation": "string" },
      "durationMs": number
    }
  ]
}

CARD RULES:
1. First card MUST be type "hook" with a surprising fact, provocative question, or scenario from the source.
2. Middle cards are "narration" and "interaction".
3. At least one card MUST be "interaction" with quizJson.
4. Last card MUST be "feedback" — key takeaway and source credit.
5. Total cards: exactly 4.`;

async function generateOneReel(
  topicLabel: string,
  topicDescription: string,
  bloomLevel: BloomLevel,
  reelNumber: number,
  totalCount: number,
  isDeeper: boolean
) {
  const bloom = BLOOMS[bloomLevel];
  const anthropic = getAnthropicClient();

  const userPrompt = `Generate a Learning Reel on the topic: "${topicLabel}"

TOPIC CONTEXT: ${topicDescription}

BLOOM'S LEVEL: ${bloom.label} — ${bloom.description}
Cognitive verb: "${bloom.verb}". Content and quiz must target this thinking level.

${isDeeper ? "DEEPER DIVE: This is an advanced reel for a learner who has completed the basics. Push into nuance, edge cases, advanced frameworks, or expert techniques." : ""}

You MUST source content from a REAL, reliable online resource (HBR, MIT Sloan, McKinsey, BCG, peer-reviewed research, named experts). Cite the specific article and author. Include the actual URL.

${reelNumber > 1 ? `This is reel ${reelNumber} of ${totalCount}. Cover a DIFFERENT angle, source, and concept than previous reels in this series.` : "Pick the most foundational concept first."}

Generate a complete 4-card reel: hook → narration → interaction → feedback.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { topicLabel, topicDescription } = await request.json();
  if (!topicLabel || !topicDescription) {
    return NextResponse.json({ error: "Missing topic data" }, { status: 400 });
  }

  // Create a custom topic
  const baseSlug = slugify(topicLabel);
  const slug = `${baseSlug}-${session.uid.slice(-6)}-${Date.now().toString(36)}`;

  // For custom topics, use the unique slug as the category so /topics/[slug] feed lookups work
  const topic = await prisma.topic.create({
    data: {
      slug,
      label: topicLabel,
      description: topicDescription,
      category: slug,
      userId: session.uid,
      isCustom: true,
    },
  });

  // Generate 3 reels — return topic immediately, generate in background.
  // Learners can request additional advanced reels via the "Dive Deeper"
  // option at the end of the feed.
  const TOTAL = 3;

  // Build the bloom sequence
  const bloomSequence: BloomLevel[] = [];
  for (const [level, count] of DISTRIBUTION) {
    for (let i = 0; i < count; i++) bloomSequence.push(level);
  }

  // Fire-and-forget background generation
  (async () => {
    for (let i = 0; i < TOTAL; i++) {
      const bloom = bloomSequence[i] || "understand";
      try {
        const reelData = await generateOneReel(topicLabel, topicDescription, bloom, i + 1, TOTAL, false);
        if (!reelData || !reelData.title || !Array.isArray(reelData.cards)) continue;

        const coachPersona = serializeCoachPersona(
          (reelData.coachPersona as GeneratedCoachPersona | undefined) ?? null,
          {
            reelTitle: reelData.title,
            reelSummary: reelData.summary || "",
            topicLabel,
            coreCompetency: reelData.coreCompetency || null,
            sourceCredit: reelData.sourceCredit || null,
            sourceUrl: reelData.sourceUrl || null,
            bloomLevel: bloom,
          }
        );

        // Validate the AI-generated sourceUrl before persisting — Claude
        // frequently hallucinate URLs that return 404/403.
        let verifiedUrl: string | null = null;
        if (reelData.sourceUrl) {
          verifiedUrl = await checkUrlAlive(reelData.sourceUrl);
          if (!verifiedUrl) {
            console.warn(`[explore:generate] dead sourceUrl for "${reelData.title}": ${reelData.sourceUrl}`);
          }
        }

        const reel = await prisma.learningReel.create({
          data: {
            topicId: topic.id,
            title: reelData.title,
            summary: reelData.summary || "",
            bloomLevel: bloom,
            estimatedSeconds: reelData.estimatedSeconds || 240,
            contentJson: JSON.stringify(reelData),
            coachPersona,
            status: "published",
            sourceUrl: verifiedUrl,
            sourceCredit: reelData.sourceCredit || null,
            coreCompetency: reelData.coreCompetency || null,
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
              animationCue: card.animationCue || null,
              quizJson: card.quizJson ? JSON.stringify(card.quizJson) : null,
              durationMs: card.durationMs || 60000,
            },
          });
        }
      } catch (e) {
        console.error(`Failed to generate reel ${i + 1}:`, e);
      }
    }
  })();

  return NextResponse.json({
    topicId: topic.id,
    slug: topic.slug,
    label: topic.label,
    total: TOTAL,
  });
}
