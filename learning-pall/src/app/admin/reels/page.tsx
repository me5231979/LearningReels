import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Database from "better-sqlite3";
import { existsSync } from "fs";
import path from "path";
import ReelsClient from "./ReelsClient";

export const dynamic = "force-dynamic";

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

export default async function ReelsAdminPage() {
  const me = await requireAdmin();
  if (!me) return null;

  const [reels, topics] = await Promise.all([
    prisma.learningReel.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        summary: true,
        bloomLevel: true,
        status: true,
        createdAt: true,
        topic: { select: { id: true, slug: true, label: true } },
        _count: { select: { progress: true, reactions: true, reports: true } },
        reactions: {
          where: { thumbs: { not: null } },
          select: { thumbs: true },
        },
      },
    }),
    prisma.topic.findMany({
      where: { isActive: true },
      orderBy: { label: "asc" },
      select: { id: true, slug: true, label: true },
    }),
  ]);

  // Fetch isFeatured via raw SQL — Prisma client cache may not know this column yet.
  const featuredSet = new Set<string>();
  try {
    const db = getRawDb();
    const rows = db.prepare(`SELECT id FROM LearningReel WHERE isFeatured = 1`).all() as { id: string }[];
    for (const r of rows) featuredSet.add(r.id);
    db.close();
  } catch (e) {
    console.error("Failed to fetch featured reels:", e);
  }

  const shaped = reels.map((r) => {
    const up = r.reactions.filter((x) => x.thumbs === "up").length;
    const down = r.reactions.filter((x) => x.thumbs === "down").length;
    return {
      id: r.id,
      title: r.title,
      summary: r.summary,
      bloomLevel: r.bloomLevel,
      status: r.status,
      isFeatured: featuredSet.has(r.id),
      createdAt: r.createdAt.toISOString(),
      topic: r.topic,
      completions: r._count.progress,
      reportCount: r._count.reports,
      thumbsUp: up,
      thumbsDown: down,
    };
  });

  return <ReelsClient reels={shaped} topics={topics} />;
}
