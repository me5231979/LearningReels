import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Records an engagement event for a comm: "dismissed" (close X / Got it) or
 * "cta_clicked". Increments the per-user counter on CommUserState. Does not
 * affect the 3-view cap — the cap is purely session-based.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const event = body?.event;

  if (event !== "dismissed" && event !== "cta_clicked") {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const comm = await prisma.comm.findUnique({ where: { id } });
  if (!comm) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data =
    event === "dismissed"
      ? { dismissedCount: { increment: 1 } }
      : { ctaClickedCount: { increment: 1 } };

  await prisma.commUserState.upsert({
    where: { commId_userId: { commId: id, userId: session.uid } },
    create: {
      commId: id,
      userId: session.uid,
      viewCount: 0,
      ...(event === "dismissed"
        ? { dismissedCount: 1 }
        : { ctaClickedCount: 1 }),
    },
    update: data,
  });

  return NextResponse.json({ ok: true });
}
