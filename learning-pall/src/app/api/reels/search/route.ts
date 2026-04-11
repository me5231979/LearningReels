import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVisibleToUser, parseTargetDepartments } from "@/lib/departments";

export async function GET(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  const category = request.nextUrl.searchParams.get("category");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 30), 60);

  if (!q) {
    return NextResponse.json({ reels: [] });
  }

  const where: Record<string, unknown> = {
    status: "published",
    OR: [
      { title: { contains: q } },
      { summary: { contains: q } },
      { topic: { label: { contains: q } } },
      { topic: { description: { contains: q } } },
      { coreCompetency: { contains: q } },
    ],
  };

  if (category) {
    where.topic = { category };
  }

  const reels = await prisma.learningReel.findMany({
    where,
    include: {
      topic: { select: { id: true, label: true, category: true, slug: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit * 2, // fetch extra since we post-filter by department
  });

  // Filter by user's department targeting
  const me = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { department: true },
  });
  const visible = reels
    .filter((r) =>
      isVisibleToUser(
        parseTargetDepartments(
          (r as { targetDepartments?: string | null }).targetDepartments ?? null
        ),
        me?.department ?? null
      )
    )
    .slice(0, limit);

  return NextResponse.json({
    reels: visible.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      bloomLevel: r.bloomLevel,
      estimatedSeconds: r.estimatedSeconds,
      topicId: r.topic.id,
      topicLabel: r.topic.label,
      categorySlug: r.topic.category,
      isFeatured: r.isFeatured,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
