import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      jobTitle: true,
      department: true,
      points: true,
      streak: true,
      lastActiveAt: true,
      createdAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [progress, reactions, bloomLevels, dueReviews] = await Promise.all([
    prisma.userProgress.findMany({
      where: { userId: id },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      take: 10,
      include: {
        reel: { select: { id: true, title: true, topic: { select: { label: true } } } },
      },
    }),
    prisma.userReaction.findMany({
      where: { userId: id, OR: [{ thumbs: { not: null } }, { favorited: true }] },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        reel: { select: { id: true, title: true } },
      },
    }),
    prisma.userBloomLevel.findMany({
      where: { userId: id },
      include: { topic: { select: { id: true, label: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.spacedReview.count({
      where: { userId: id, nextReviewAt: { lte: new Date() } },
    }),
  ]);

  const completedCount = await prisma.userProgress.count({
    where: { userId: id, status: "completed" },
  });

  const avgScoreAgg = await prisma.userProgress.aggregate({
    where: { userId: id, status: "completed", score: { not: null } },
    _avg: { score: true },
  });

  return NextResponse.json({
    user: {
      ...user,
      lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    },
    stats: {
      completedCount,
      avgScore: avgScoreAgg._avg.score ? Math.round(avgScoreAgg._avg.score) : null,
      dueReviews,
    },
    progress: progress.map((p) => ({
      id: p.id,
      reelId: p.reel.id,
      reelTitle: p.reel.title,
      topicLabel: p.reel.topic.label,
      status: p.status,
      score: p.score,
      completedAt: p.completedAt?.toISOString() ?? null,
    })),
    reactions: reactions.map((r) => ({
      id: r.id,
      reelId: r.reel.id,
      reelTitle: r.reel.title,
      thumbs: r.thumbs,
      favorited: r.favorited,
      updatedAt: r.updatedAt.toISOString(),
    })),
    bloomLevels: bloomLevels.map((b) => ({
      topicId: b.topic.id,
      topicLabel: b.topic.label,
      currentLevel: b.currentLevel,
      completions: b.completions,
      avgScore: b.avgScore,
    })),
  });
}
