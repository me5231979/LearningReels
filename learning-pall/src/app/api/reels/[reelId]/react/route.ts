import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reelId: string }> }
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { reelId } = await params;
  const body = await request.json();
  const { thumbs, favorited } = body as {
    thumbs?: "up" | "down" | null;
    favorited?: boolean;
  };

  const updateData: { thumbs?: "up" | "down" | null; favorited?: boolean } = {};
  if (thumbs !== undefined) updateData.thumbs = thumbs;
  if (favorited !== undefined) updateData.favorited = favorited;

  const reaction = await prisma.userReaction.upsert({
    where: { userId_reelId: { userId: session.uid, reelId } },
    create: {
      userId: session.uid,
      reelId,
      thumbs: thumbs ?? null,
      favorited: favorited ?? false,
    },
    update: updateData,
    select: { thumbs: true, favorited: true },
  });

  return NextResponse.json({ reaction });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reelId: string }> }
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { reelId } = await params;
  const row = await prisma.userReaction.findUnique({
    where: { userId_reelId: { userId: session.uid, reelId } },
    select: { thumbs: true, favorited: true },
  });

  return NextResponse.json({
    reaction: row ?? { thumbs: null, favorited: false },
  });
}
