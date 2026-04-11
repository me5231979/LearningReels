import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAnthropicClient } from "@/lib/claude";
import {
  MAX_COACH_TURNS,
  buildCoachSystemPrompt,
  openingQuestionFor,
  parseStoredCoachPersona,
  type StoredCoachPersona,
} from "@/lib/coach";

type StoredMessage = { role: "user" | "assistant"; content: string; ts: number };

/**
 * Load the reel with its coach persona. For legacy reels without a persona
 * stored, synthesize one on-the-fly from reel metadata so the Coach still
 * works without needing a regeneration pass.
 */
async function loadReelWithPersona(reelId: string): Promise<
  | {
      reelId: string;
      title: string;
      persona: StoredCoachPersona;
    }
  | null
> {
  const reel = await prisma.learningReel.findUnique({
    where: { id: reelId },
    include: { topic: true },
  });
  if (!reel) return null;

  const stored = parseStoredCoachPersona(reel.coachPersona ?? null);
  if (stored) {
    return { reelId: reel.id, title: reel.title, persona: stored };
  }

  // Fall back: synthesize a persona from reel metadata.
  const ctx = {
    reelTitle: reel.title,
    reelSummary: reel.summary,
    topicLabel: reel.topic.label,
    coreCompetency: reel.coreCompetency ?? null,
    sourceCredit: reel.sourceCredit ?? null,
    sourceUrl: reel.sourceUrl ?? null,
    bloomLevel: reel.bloomLevel,
  };
  const synthesized: StoredCoachPersona = {
    systemPrompt: buildCoachSystemPrompt(null, ctx),
    openingQuestion: openingQuestionFor(null, ctx),
  };
  return { reelId: reel.id, title: reel.title, persona: synthesized };
}

function parseMessages(raw: string | null | undefined): StoredMessage[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as StoredMessage[];
  } catch {}
  return [];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reelId: string }> }
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { reelId } = await params;

  const loaded = await loadReelWithPersona(reelId);
  if (!loaded) {
    return NextResponse.json({ error: "Reel not found" }, { status: 404 });
  }

  const convo = await prisma.coachConversation.findUnique({
    where: { userId_reelId: { userId: session.uid, reelId } },
  });

  return NextResponse.json({
    openingQuestion: loaded.persona.openingQuestion,
    messages: convo ? parseMessages(convo.messages) : [],
    turnsUsed: convo?.turnsUsed ?? 0,
    turnsRemaining: Math.max(0, MAX_COACH_TURNS - (convo?.turnsUsed ?? 0)),
    maxTurns: MAX_COACH_TURNS,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reelId: string }> }
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { reelId } = await params;

  const body = await request.json();
  const userMessage = typeof body?.message === "string" ? body.message.trim() : "";
  if (!userMessage) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  if (userMessage.length > 2000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const loaded = await loadReelWithPersona(reelId);
  if (!loaded) {
    return NextResponse.json({ error: "Reel not found" }, { status: 404 });
  }

  // Load-or-create conversation
  const existing = await prisma.coachConversation.findUnique({
    where: { userId_reelId: { userId: session.uid, reelId } },
  });
  const prevMessages = parseMessages(existing?.messages ?? null);
  const turnsUsed = existing?.turnsUsed ?? 0;

  if (turnsUsed >= MAX_COACH_TURNS) {
    return NextResponse.json(
      {
        error: "turn_limit_reached",
        message:
          "You've reached the coaching turn limit for this reel. Take what you've got and go apply it.",
        turnsUsed,
        turnsRemaining: 0,
        maxTurns: MAX_COACH_TURNS,
      },
      { status: 429 }
    );
  }

  const now = Date.now();
  const updatedMessages: StoredMessage[] = [
    ...prevMessages,
    { role: "user", content: userMessage, ts: now },
  ];

  // Call Claude (Haiku — cheap, fast, plenty smart for coaching)
  let assistantText = "";
  try {
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: loaded.persona.systemPrompt,
      messages: updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
    assistantText =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
  } catch (e) {
    console.error("Coach chat error:", e);
    return NextResponse.json(
      { error: "Coach is temporarily unavailable. Try again in a moment." },
      { status: 502 }
    );
  }

  if (!assistantText) {
    return NextResponse.json(
      { error: "Coach returned an empty response. Try rephrasing." },
      { status: 502 }
    );
  }

  const finalMessages: StoredMessage[] = [
    ...updatedMessages,
    { role: "assistant", content: assistantText, ts: Date.now() },
  ];
  const nextTurnsUsed = turnsUsed + 1;

  await prisma.coachConversation.upsert({
    where: { userId_reelId: { userId: session.uid, reelId } },
    create: {
      userId: session.uid,
      reelId,
      messages: JSON.stringify(finalMessages),
      turnsUsed: nextTurnsUsed,
    },
    update: {
      messages: JSON.stringify(finalMessages),
      turnsUsed: nextTurnsUsed,
    },
  });

  return NextResponse.json({
    reply: assistantText,
    messages: finalMessages,
    turnsUsed: nextTurnsUsed,
    turnsRemaining: Math.max(0, MAX_COACH_TURNS - nextTurnsUsed),
    maxTurns: MAX_COACH_TURNS,
  });
}
