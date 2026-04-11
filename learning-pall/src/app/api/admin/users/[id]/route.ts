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

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cannot edit a super admin unless you ARE that super admin
  if (target.role === "super_admin" && me.id !== target.id) {
    return NextResponse.json({ error: "Cannot edit super admin" }, { status: 403 });
  }

  const allowed: Record<string, unknown> = {};
  for (const key of ["name", "email", "jobTitle", "department"] as const) {
    if (key in body) {
      const v = body[key];
      allowed[key] = key === "email" && typeof v === "string" ? v.toLowerCase() : v;
    }
  }
  if ("deletedAt" in body) {
    // Cannot soft-delete super admin or yourself
    if (target.role === "super_admin") {
      return NextResponse.json({ error: "Cannot delete super admin" }, { status: 403 });
    }
    if (target.id === me.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 403 });
    }
    allowed.deletedAt = body.deletedAt ? new Date(body.deletedAt) : null;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: allowed,
    select: {
      id: true, email: true, name: true, role: true, jobTitle: true, department: true,
      points: true, streak: true, lastActiveAt: true, createdAt: true, deletedAt: true,
    },
  });

  await prisma.adminAction.create({
    data: {
      actorId: me.id,
      action: "user.edit",
      targetType: "user",
      targetId: id,
      metadata: JSON.stringify(allowed),
    },
  });

  return NextResponse.json({
    user: {
      ...updated,
      lastActiveAt: updated.lastActiveAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      deletedAt: updated.deletedAt?.toISOString() ?? null,
    },
  });
}
