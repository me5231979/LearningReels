import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateReelsForTopic } from "@/lib/generate-reels";
import type { BloomsLevel } from "@/types/course";

const BLOOM_LEVELS: BloomsLevel[] = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
];

// Distribute 20 reels across Bloom's levels: 4 remember, 4 understand, 4 apply, 3 analyze, 3 evaluate, 2 create
const LEVEL_DISTRIBUTION: Record<BloomsLevel, number> = {
  remember: 4,
  understand: 4,
  apply: 4,
  analyze: 3,
  evaluate: 3,
  create: 2,
};

export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Only admins can bulk generate
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { category, targetCount = 20 } = body as {
    category?: string;
    targetCount?: number;
  };

  // Get topics to generate for
  const topics = await prisma.topic.findMany({
    where: category ? { category, isActive: true } : { isActive: true },
    include: {
      _count: { select: { reels: true } },
    },
  });

  if (topics.length === 0) {
    return NextResponse.json({ error: "No topics found" }, { status: 404 });
  }

  const results: { topic: string; category: string; generated: number; total: number }[] = [];

  for (const topic of topics) {
    const existingCount = topic._count.reels;
    const needed = Math.max(0, targetCount - existingCount);

    if (needed === 0) {
      results.push({
        topic: topic.label,
        category: topic.category,
        generated: 0,
        total: existingCount,
      });
      continue;
    }

    // Distribute needed reels across bloom levels
    let generated = 0;
    for (const level of BLOOM_LEVELS) {
      if (generated >= needed) break;

      const levelCount = Math.min(
        LEVEL_DISTRIBUTION[level],
        needed - generated
      );

      if (levelCount <= 0) continue;

      try {
        const ids = await generateReelsForTopic(topic.slug, level, levelCount);
        generated += ids.length;
        console.log(
          `Generated ${ids.length} ${level}-level reels for ${topic.label}`
        );
      } catch (err) {
        console.error(`Error generating ${level} reels for ${topic.label}:`, err);
      }
    }

    results.push({
      topic: topic.label,
      category: topic.category,
      generated,
      total: existingCount + generated,
    });
  }

  const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0);
  return NextResponse.json({
    message: `Generated ${totalGenerated} reels across ${results.length} topics`,
    results,
  });
}
