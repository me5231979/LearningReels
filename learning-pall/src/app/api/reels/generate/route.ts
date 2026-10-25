import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateReelsForTopic } from "@/lib/generate-reels";
import type { BloomsLevel } from "@/types/course";

export async function POST(request: NextRequest) {
  // Each reel is a paid Claude call; learners get reels through Explore,
  // so direct generation is admin-only and capped per request.
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { topicSlug, bloomLevel } = body;
  const count = Math.min(Math.max(Math.floor(Number(body.count) || 1), 1), 5);

  if (!topicSlug || !bloomLevel) {
    return NextResponse.json(
      { error: "topicSlug and bloomLevel are required" },
      { status: 400 }
    );
  }

  const topic = await prisma.topic.findUnique({
    where: { slug: topicSlug },
  });

  if (!topic || !topic.isActive) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const reelIds = await generateReelsForTopic(
    topicSlug,
    bloomLevel as BloomsLevel,
    count
  );

  return NextResponse.json({ reelIds, generated: reelIds.length });
}
