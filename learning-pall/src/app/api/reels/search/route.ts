import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVisibleToUser, parseTargetDepartments } from "@/lib/departments";
import Database from "better-sqlite3";
import { existsSync } from "fs";
import path from "path";

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

  // Fetch isFeatured via raw SQL — Prisma client cache may not know the column yet.
  const featuredSet = new Set<string>();
  if (visible.length > 0) {
    try {
      const db = getRawDb();
      const placeholders = visible.map(() => "?").join(",");
      const rows = db
        .prepare(`SELECT id FROM LearningReel WHERE isFeatured = 1 AND id IN (${placeholders})`)
        .all(...visible.map((r) => r.id)) as { id: string }[];
      for (const r of rows) featuredSet.add(r.id);
      db.close();
    } catch (e) {
      console.error("Failed to fetch featured set:", e);
    }
  }

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
      isFeatured: featuredSet.has(r.id),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
