import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "super_admin" && me.id !== target.id) {
    return NextResponse.json({ error: "Cannot reset super admin" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.userProgress.deleteMany({ where: { userId: id } }),
    prisma.userBloomLevel.deleteMany({ where: { userId: id } }),
    prisma.spacedReview.deleteMany({ where: { userId: id } }),
    prisma.user.update({ where: { id }, data: { points: 0, streak: 0 } }),
  ]);

  await prisma.adminAction.create({
    data: {
      actorId: me.id,
      action: "user.reset_progress",
      targetType: "user",
      targetId: id,
    },
  });

  return NextResponse.json({ ok: true });
}
