import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getAnthropicClient } from "@/lib/claude";
import Database from "better-sqlite3";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

function getRawDb() {
  const candidates = [
    path.join(process.cwd(), "data", "learning-pall.db"),
    path.join(process.cwd(), "learning-pall", "data", "learning-pall.db"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return new Database(p);
  }
  return new Database("/Users/estesm4/Desktop/Learning Pall/learning-pall/data/learning-pall.db");
}

const SYSTEM = `You are the Explore validator for Learning Reels — Vanderbilt's professional development micro-learning platform. A user has submitted a topic they want to learn about. Classify it.

CLASSIFICATIONS:
- "APPROVED": Practical professional skills, career growth, leadership, communication, AI fluency, productivity, workplace wellbeing, business knowledge, software/tech skills, soft skills, management, project management, professional writing, etc. Anything a working professional would learn for career growth.
- "RESTRICTED": Reject these outright with a friendly explanation:
  • Health treatment, medical advice, mental health treatment, diagnosis
  • Anything dangerous (weapons, explosives, illegal activity, hacking/exploits)
  • Alcohol, drugs, controlled substances, recreational substances
  • Deep academic theory: pure math, theoretical physics, abstract science, philosophy of science (these aren't practical workplace skills)
  • Adult content, gambling, extremism, conspiracy theories
- "GREY_AREA": Borderline topics that need admin review (e.g., workplace stress that touches mental health, negotiation tactics that border on manipulation, AI ethics in narrow contexts). Flag for admin but allow user to know it's under review.

PRINCIPLES:
- Be GENEROUS with APPROVED — most professional learning topics should pass.
- Hold the learner accountable to PRACTICAL learning. If they ask for "quantum field theory" or "the philosophical foundations of consciousness", classify as RESTRICTED with a friendly redirect.
- If they ask something vague like "leadership", APPROVED — just frame it concretely.

OUTPUT FORMAT — respond with JSON only, no markdown:
{
  "classification": "APPROVED" | "RESTRICTED" | "GREY_AREA",
  "reason": "string — friendly 1-2 sentence explanation for the user",
  "refinedTopic": "string — a clean, professional topic title (max 60 chars). Only set if APPROVED or GREY_AREA.",
  "topicDescription": "string — 1-sentence description of what they'll learn. Only set if APPROVED or GREY_AREA."
}`;

export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { topic } = await request.json();
  if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
    return NextResponse.json(
      { error: "Please describe what you'd like to learn (at least 3 characters)." },
      { status: 400 }
    );
  }

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: SYSTEM,
    messages: [{ role: "user", content: `Topic: "${topic.trim()}"` }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json(
      { error: "Could not validate topic. Please try again." },
      { status: 500 }
    );
  }

  let parsed: {
    classification: "APPROVED" | "RESTRICTED" | "GREY_AREA";
    reason: string;
    refinedTopic?: string;
    topicDescription?: string;
  };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json(
      { error: "Validator returned invalid response. Please try again." },
      { status: 500 }
    );
  }

  // Log GREY_AREA flags for admin review
  if (parsed.classification === "GREY_AREA") {
    try {
      const db = getRawDb();
      db.prepare(
        `INSERT INTO AdminFlag (id, userId, content, reason, classification) VALUES (?, ?, ?, ?, ?)`
      ).run(randomUUID(), session.uid, topic.trim(), parsed.reason, parsed.classification);
      db.close();
    } catch (e) {
      console.error("Failed to log admin flag:", e);
    }
  }

  return NextResponse.json(parsed);
}
