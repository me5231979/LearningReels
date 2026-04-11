import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const dueReviews = await prisma.spacedReview.findMany({
    where: {
      userId: session.uid,
      nextReviewAt: { lte: new Date() },
    },
    include: {
      reel: {
        select: { id: true, title: true, bloomLevel: true },
      },
    },
    orderBy: { nextReviewAt: "asc" },
    take: 10,
  });

  return NextResponse.json({
    reviews: dueReviews.map((r) => ({
      id: r.id,
      reelId: r.reel.id,
      reelTitle: r.reel.title,
      bloomLevel: r.reel.bloomLevel,
      intervalDays: r.intervalDays,
      repetitionCount: r.repetitionCount,
    })),
    count: dueReviews.length,
  });
}
