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

  const existing = await prisma.comm.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: { active?: boolean } = {};
  if (typeof body.active === "boolean") data.active = body.active;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Only one active comm at a time — deactivate others when activating this one
  await prisma.$transaction(async (tx) => {
    if (data.active === true) {
      await tx.comm.updateMany({
        where: { active: true, NOT: { id } },
        data: { active: false },
      });
    }
    await tx.comm.update({ where: { id }, data });
  });

  await prisma.adminAction.create({
    data: {
      actorId: me.id,
      action: "comm.toggle",
      targetType: "comm",
      targetId: id,
      metadata: JSON.stringify({ active: data.active }),
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
  const existing = await prisma.comm.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.comm.delete({ where: { id } });
  await prisma.adminAction.create({
    data: {
      actorId: me.id,
      action: "comm.delete",
      targetType: "comm",
      targetId: id,
      metadata: JSON.stringify({ heading: existing.heading }),
    },
  });

  return NextResponse.json({ ok: true });
}
