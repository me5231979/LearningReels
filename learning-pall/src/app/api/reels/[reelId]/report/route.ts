import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const VALID_REASONS = ["policy", "inaccurate", "inappropriate", "off_topic", "other"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reelId: string }> }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { reelId } = await params;
  const body = await request.json().catch(() => ({}));
  const { reason, details } = body as { reason?: string; details?: string };

  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }

  const reel = await prisma.learningReel.findUnique({ where: { id: reelId } });
  if (!reel) return NextResponse.json({ error: "Reel not found" }, { status: 404 });

  const report = await prisma.contentReport.create({
    data: {
      reelId,
      userId: session.uid,
      reason,
      details: details?.slice(0, 500) || null,
      status: "open",
    },
  });

  return NextResponse.json({ ok: true, id: report.id });
}
