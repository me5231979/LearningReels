import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAnthropicClient } from "@/lib/claude";
import type { BloomsLevel } from "@/types/course";

const BLOOM_ORDER: BloomsLevel[] = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
];

export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { reelId, cardId, userAnswer, correctAnswer } = await request.json();

  // Get the reel and card context
  const reel = await prisma.learningReel.findUnique({
    where: { id: reelId },
    include: { topic: true },
  });

  const card = await prisma.reelCard.findUnique({
    where: { id: cardId },
  });

  if (!reel || !card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Drop one Bloom's level for remediation
  const currentIndex = BLOOM_ORDER.indexOf(reel.bloomLevel as BloomsLevel);
  const remedialLevel = BLOOM_ORDER[Math.max(0, currentIndex - 1)];

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are a Vanderbilt University learning coach creating a remedial explanation card.
The learner got a question wrong. Create a simpler, clearer explanation that breaks down the concept.

CONTENT RESTRICTIONS: Focus on professional skills. No DEI topics or inclusionist language.

Respond with JSON only:
{
  "cardType": "narration",
  "title": "string",
  "script": "string (80-120 words, clear and simple)",
  "visualDescription": "string",
  "animationCue": "reveal",
  "quizJson": null,
  "durationMs": 60000
}`,
    messages: [
      {
        role: "user",
        content: `The learner was studying "${reel.topic.label}" at the ${reel.bloomLevel} level.

They got this wrong:
Question context: ${card.script}
Quiz: ${card.quizJson}
Their answer: ${userAnswer}
Correct answer: ${correctAnswer}

Create a remedial card at the "${remedialLevel}" level that explains this concept more simply. Use an analogy or real-world example.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const remedialCard = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!remedialCard) {
      return NextResponse.json(
        { error: "Failed to generate remedial content" },
        { status: 500 }
      );
    }

    return NextResponse.json({ card: remedialCard });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse remedial content" },
      { status: 500 }
    );
  }
}
