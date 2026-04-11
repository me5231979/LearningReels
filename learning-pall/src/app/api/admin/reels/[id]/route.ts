import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const reel = await prisma.learningReel.findUnique({ where: { id } });
  if (!reel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reelUpdate: Record<string, unknown> = {};
  for (const key of ["title", "summary", "status", "sourceCredit", "sourceUrl"] as const) {
    if (key in body) reelUpdate[key] = body[key];
  }
  if ("isFeatured" in body) {
    reelUpdate.isFeatured = !!body.isFeatured;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(reelUpdate).length) {
      await tx.learningReel.update({ where: { id }, data: reelUpdate });
    }
    if (Array.isArray(body.cards)) {
      for (const c of body.cards) {
        if (!c.id) continue;
        const cu: Record<string, unknown> = {};
        for (const k of ["title", "script", "quizJson"] as const) {
          if (k in c) cu[k] = c[k];
        }
        if (Object.keys(cu).length) {
          await tx.reelCard.update({ where: { id: c.id }, data: cu });
        }
      }
    }
  });

  await prisma.adminAction.create({
    data: {
      actorId: me.id,
      action: "reel.edit",
      targetType: "reel",
      targetId: id,
      metadata: JSON.stringify({ fields: Object.keys(reelUpdate), cards: Array.isArray(body.cards) ? body.cards.length : 0 }),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const reel = await prisma.learningReel.findUnique({ where: { id } });
  if (!reel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.learningReel.delete({ where: { id } });
  await prisma.adminAction.create({
    data: {
      actorId: me.id,
      action: "reel.delete",
      targetType: "reel",
      targetId: id,
      metadata: JSON.stringify({ title: reel.title }),
    },
  });

  return NextResponse.json({ ok: true });
}
