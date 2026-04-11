import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateReelsForTopic } from "@/lib/generate-reels";
import type { BloomsLevel } from "@/types/course";

export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { topicSlug, bloomLevel, count = 1 } = await request.json();

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
