import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAnthropicClient } from "@/lib/claude";
import { serializeCoachPersona, type GeneratedCoachPersona } from "@/lib/coach";

const SYSTEM_PROMPT = `You are a Vanderbilt University learning content architect creating ADVANCED Learning Reels for a learner who has completed the basics on a topic.

VOICE: Confident, expert-level, growth-oriented. Push beyond fundamentals into nuance, edge cases, advanced frameworks, and expert techniques.

CRITICAL REQUIREMENTS:
- Source from REAL, reliable online resources you know about (HBR, MIT Sloan, McKinsey, BCG, peer-reviewed research, named experts).
- Cite specific articles and authors with REAL URLs.
- Each reel MUST align to ONE Vanderbilt core competency:
  1. "Radically collaborates and cultivates belonging"
  2. "Embodies an entrepreneurial spirit and leverages data and technology"
  3. "Continuously strives for excellence"
  4. "Grows self and others"
  5. "Leads and inspires teams"
  6. "Develops and implements University strategy"
  7. "Makes effective and ethical decisions for the University"

CONTENT RESTRICTIONS:
- Practical professional skills only. NO health treatment, dangerous activities, alcohol/drugs, deep abstract theory.
- No DEI topics or inclusionist language.

VISUAL DESCRIPTION REQUIREMENTS:
- All visualDescription fields MUST depict Western society and culture exclusively.
- Settings must be modern American or Western European corporate or academic environments.
- People, attire, architecture, and cultural references must reflect contemporary Western (US, Canada, UK, Western Europe) life.
- Do NOT describe East Asian, Middle Eastern, South Asian, or non-Western elements.

PEDAGOGICAL MODEL:
- Each reel: 4 cards (hook → narration → interaction → feedback).
- Target Bloom's "analyze", "evaluate", or "create" levels.
- Quiz questions test deep application, not recall.

OUTPUT JSON only, no markdown:
{
  "title": "string max 60 chars",
  "summary": "string",
  "sourceUrl": "string — REAL URL",
  "sourceCredit": "string",
  "coreCompetency": "string — one of the 7",
  "coachPersona": {
    "role": "string — who the reel's Coach chatbot is",
    "expertise": "string — what the coach knows, grounded in this reel's source",
    "openingQuestion": "string — a concrete first question referencing THIS reel",
    "guardrails": "string — stay on topic; refuse off-topic / DEI / health / abstract theory"
  },
  "estimatedSeconds": number,
  "cards": [
    { "cardType": "hook"|"narration"|"interaction"|"feedback", "title": "string", "script": "string 60-120 words", "visualDescription": "string", "animationCue": "string", "quizJson": null | {"question":"string","choices":["a","b","c","d"],"correctIndex":number,"explanation":"string"}, "durationMs": number }
  ]
}

Exactly 4 cards. First = hook, last = feedback, at least one = interaction with quizJson.`;

export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { topicId } = await request.json();
  if (!topicId) {
    return NextResponse.json({ error: "Missing topicId" }, { status: 400 });
  }

  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }
  if (topic.userId !== session.uid) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const TOTAL = 5;

  (async () => {
    const anthropic = getAnthropicClient();
    for (let i = 0; i < TOTAL; i++) {
      try {
        const userPrompt = `Generate an ADVANCED Learning Reel on: "${topic.label}"

CONTEXT: ${topic.description}

This is reel ${i + 1} of ${TOTAL} in a deeper-dive series. The learner has already completed the foundational reels on this topic. Push into expert territory: nuance, edge cases, advanced frameworks, counterintuitive findings.

Source from a real, reputable publication or research paper. Include the actual URL and author.`;

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;

        const reelData = JSON.parse(jsonMatch[0]);
        if (!reelData.title || !Array.isArray(reelData.cards)) continue;

        const bloomLevel = ["analyze", "evaluate", "create"][i % 3];
        const coachPersona = serializeCoachPersona(
          (reelData.coachPersona as GeneratedCoachPersona | undefined) ?? null,
          {
            reelTitle: reelData.title,
            reelSummary: reelData.summary || "",
            topicLabel: topic.label,
            coreCompetency: reelData.coreCompetency || null,
            sourceCredit: reelData.sourceCredit || null,
            sourceUrl: reelData.sourceUrl || null,
            bloomLevel,
          }
        );

        const reel = await prisma.learningReel.create({
          data: {
            topicId: topic.id,
            title: reelData.title,
            summary: reelData.summary || "",
            bloomLevel,
            estimatedSeconds: reelData.estimatedSeconds || 240,
            contentJson: JSON.stringify(reelData),
            coachPersona,
            status: "published",
            sourceUrl: reelData.sourceUrl || null,
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
        console.error(`Deeper reel ${i + 1} failed:`, e);
      }
    }
  })();

  return NextResponse.json({ ok: true, total: TOTAL });
}
