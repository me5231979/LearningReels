import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVisibleToUser, parseTargetDepartments } from "@/lib/departments";

/**
 * GET /api/topics — returns all active topics grouped by category,
 * with reel counts and user progress.
 */
export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { department: true },
  });
  const userDepartment = me?.department ?? null;

  const topics = await prisma.topic.findMany({
    where: { isActive: true },
    include: {
      reels: {
        where: { status: "published" },
        select: { id: true, targetDepartments: true },
      },
      bloomLevels: {
        where: { userId: session.uid },
        select: { currentLevel: true, completions: true },
      },
    },
    orderBy: { label: "asc" },
  });

  const result = topics.map((t) => {
    const visibleReels = t.reels.filter((r) =>
      isVisibleToUser(parseTargetDepartments(r.targetDepartments), userDepartment)
    );
    return {
      id: t.id,
      slug: t.slug,
      label: t.label,
      description: t.description,
      category: t.category,
      icon: t.icon,
      reelCount: visibleReels.length,
      userLevel: t.bloomLevels[0]?.currentLevel || null,
      userCompletions: t.bloomLevels[0]?.completions || 0,
    };
  });

  return NextResponse.json({ topics: result });
}
