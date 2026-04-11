import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Only super admin can assign or revoke admin role.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requireSuperAdmin();
  if (!me) return NextResponse.json({ error: "Super admin only" }, { status: 403 });

  const { id } = await params;
  const { role } = await request.json();

  if (!["admin", "learner"].includes(role)) {
    return NextResponse.json({ error: "Role must be 'admin' or 'learner'" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "super_admin") {
    return NextResponse.json({ error: "Cannot change super admin role" }, { status: 403 });
  }

  await prisma.user.update({ where: { id }, data: { role } });
  await prisma.adminAction.create({
    data: {
      actorId: me.id,
      action: "user.role_change",
      targetType: "user",
      targetId: id,
      metadata: JSON.stringify({ from: target.role, to: role }),
    },
  });

  return NextResponse.json({ ok: true });
}
