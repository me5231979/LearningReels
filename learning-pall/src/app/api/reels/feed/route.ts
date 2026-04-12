import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVisibleToUser, parseTargetDepartments } from "@/lib/departments";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get user's topic preferences and bloom levels
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    include: {
      bloomLevels: { include: { topic: true } },
      progress: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const completedReelIds = user.progress
    .filter((p) => p.status === "completed")
    .map((p) => p.reelId);

  // 1. Overdue spaced reviews
  const dueReviews = await prisma.spacedReview.findMany({
    where: {
      userId: session.uid,
      nextReviewAt: { lte: new Date() },
    },
    include: {
      reel: {
        include: {
          topic: true,
          cards: { orderBy: { order: "asc" } },
        },
      },
    },
    orderBy: { nextReviewAt: "asc" },
  });

  // 2. Get user's preferred topics
  const userTopicIds = user.bloomLevels.map((bl) => bl.topicId);

  // If category filter provided, get topic IDs for that category
  let categoryTopicIds: string[] | null = null;
  if (category) {
    const catTopics = await prisma.topic.findMany({
      where: { category },
      select: { id: true },
    });
    categoryTopicIds = catTopics.map((t) => t.id);
  }

  // 3. Filter by category if specified, otherwise show all
  const topicFilter = categoryTopicIds
    ? { topicId: { in: categoryTopicIds } }
    : {};

  // When browsing a specific topic, show ALL its reels (including completed
  // ones) so favorites and revisits work. Otherwise hide completed reels.
  const newReels = await prisma.learningReel.findMany({
    where: {
      status: "published",
      ...(category ? {} : { id: { notIn: completedReelIds } }),
      ...topicFilter,
    },
    include: {
      topic: true,
      cards: { orderBy: { order: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    // No cap — return all available reels
  });

  // 4. If no reels at all (and no category filter), get any published reels.
  // When a category is specified, do NOT fall back to other categories — empty
  // is empty.
  let fallbackReels: typeof newReels = [];
  if (!category && dueReviews.length === 0 && newReels.length === 0) {
    fallbackReels = await prisma.learningReel.findMany({
      where: { status: "published" },
      include: {
        topic: true,
        cards: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Assemble feed: reviews first, then new content
  // Filter due reviews by category if specified
  const filteredReviews = categoryTopicIds
    ? dueReviews.filter((r) => categoryTopicIds!.includes(r.reel.topicId))
    : dueReviews;

  const allReels = [
    ...filteredReviews.map((r) => r.reel),
    ...newReels,
    ...fallbackReels,
  ];

  // Deduplicate
  const seen = new Set<string>();
  const dedupedReels = allReels.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  // Filter by department targeting — reels with empty targetDepartments
  // (ALL STAFF) are visible to everyone; targeted reels are only visible to
  // users whose department is in the target list.
  const userDepartment = user.department;
  const uniqueReels = dedupedReels.filter((r) => {
    const targets = parseTargetDepartments(
      (r as { targetDepartments?: string | null }).targetDepartments ?? null
    );
    return isVisibleToUser(targets, userDepartment);
  });

  // Determine which reels have an archived source
  const reelIds = uniqueReels.map((r) => r.id);
  let archivedSourceSet = new Set<string>();
  if (reelIds.length > 0) {
    const archivedRows = await prisma.reelSource.findMany({
      where: { reelId: { in: reelIds } },
      select: { reelId: true },
    });
    archivedSourceSet = new Set(archivedRows.map((r) => r.reelId));
  }

  // Topic metadata for custom topic detection (custom topics show "My Learning")
  let topicMeta: { id: string; isCustom: boolean } | null = null;
  if (category) {
    const t = await prisma.topic.findFirst({
      where: { category },
      select: { id: true, isCustom: true },
    });
    if (t) topicMeta = t;
  }

  // Format response — for custom topics, override categoryLabel to "My Learning"
  const isCustomFeed = topicMeta?.isCustom === true;
  const reels = uniqueReels.map((reel) => ({
    id: reel.id,
    title: reel.title,
    summary: reel.summary,
    bloomLevel: reel.bloomLevel,
    estimatedSeconds: reel.estimatedSeconds,
    topicLabel: reel.topic.label,
    categoryLabel: isCustomFeed ? "My Learning" : reel.topic.category,
    sourceUrl: reel.sourceUrl,
    sourceCredit: reel.sourceCredit,
    coreCompetency: reel.coreCompetency,
    isFeatured: reel.isFeatured,
    createdAt: reel.createdAt.toISOString(),
    hasArchivedSource: archivedSourceSet.has(reel.id),
    cards: reel.cards.map((card) => ({
      id: card.id,
      order: card.order,
      cardType: card.cardType,
      title: card.title,
      script: card.script,
      visualDescription: card.visualDescription,
      imageUrl: card.imageUrl,
      animationCue: card.animationCue,
      quizJson: card.quizJson,
      scenarioJson: card.scenarioJson,
      durationMs: card.durationMs,
    })),
  }));

  return NextResponse.json({
    reels,
    topic: topicMeta
      ? { id: topicMeta.id, isCustom: topicMeta.isCustom }
      : null,
  });
}
