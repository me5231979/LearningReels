import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { scoreToQuality, calculateNextReview } from "@/lib/spaced-repetition";

export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { reviewId, score } = await request.json();

  const review = await prisma.spacedReview.findFirst({
    where: { id: reviewId, userId: session.uid },
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const quality = scoreToQuality(score);
  const { nextInterval, newEaseFactor, newRepetitionCount } =
    calculateNextReview(
      quality,
      review.repetitionCount,
      review.easeFactor,
      review.intervalDays
    );

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval);

  await prisma.spacedReview.update({
    where: { id: reviewId },
    data: {
      intervalDays: nextInterval,
      easeFactor: newEaseFactor,
      repetitionCount: newRepetitionCount,
      nextReviewAt,
      lastReviewedAt: new Date(),
    },
  });

  return NextResponse.json({
    nextInterval,
    nextReviewAt: nextReviewAt.toISOString(),
  });
}
