import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reelId: string }> }
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { reelId } = await params;
  const { answers } = await request.json();

  // Verify reel exists
  const reel = await prisma.learningReel.findUnique({
    where: { id: reelId },
    include: { cards: { where: { cardType: "interaction" } } },
  });

  if (!reel) {
    return NextResponse.json({ error: "Reel not found" }, { status: 404 });
  }

  // Calculate score from quiz answers
  let score = 100;
  let correctCount = 0;
  let totalQuestions = 0;

  for (const card of reel.cards) {
    if (card.quizJson) {
      totalQuestions++;
      const quiz = JSON.parse(card.quizJson);
      const userAnswer = answers?.[card.id];
      if (userAnswer !== undefined && Number(userAnswer) === quiz.correctIndex) {
        correctCount++;
      }
    }
  }

  if (totalQuestions > 0) {
    score = Math.round((correctCount / totalQuestions) * 100);
  }

  // Upsert progress
  await prisma.userProgress.upsert({
    where: {
      userId_reelId: { userId: session.uid, reelId },
    },
    update: {
      status: "completed",
      score,
      attemptsCount: { increment: 1 },
      answers: answers ? JSON.stringify(answers) : null,
      completedAt: new Date(),
      bloomLevelAchieved: reel.bloomLevel,
    },
    create: {
      userId: session.uid,
      reelId,
      status: "completed",
      score,
      attemptsCount: 1,
      answers: answers ? JSON.stringify(answers) : null,
      completedAt: new Date(),
      bloomLevelAchieved: reel.bloomLevel,
    },
  });

  // Create spaced review entry (first review in 1 day)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  await prisma.spacedReview.upsert({
    where: {
      id: `${session.uid}-${reelId}`, // This won't match, forcing create
    },
    update: {},
    create: {
      userId: session.uid,
      reelId,
      nextReviewAt: tomorrow,
      intervalDays: 1,
      repetitionCount: 0,
      easeFactor: 2.5,
    },
  });

  // Update user points
  await prisma.user.update({
    where: { id: session.uid },
    data: {
      points: { increment: score >= 70 ? 10 : 5 },
      lastActiveAt: new Date(),
    },
  });

  return NextResponse.json({ score, correctCount, totalQuestions });
}
