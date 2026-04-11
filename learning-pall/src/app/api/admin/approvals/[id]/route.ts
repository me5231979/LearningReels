import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = body.action as "approve" | "deny" | undefined;

  if (action !== "approve" && action !== "deny") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.status !== "pending_approval") {
    return NextResponse.json(
      { error: "User is not pending approval" },
      { status: 400 }
    );
  }

  const newStatus = action === "approve" ? "active" : "denied";

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { status: newStatus },
    }),
    prisma.adminAction.create({
      data: {
        actorId: me.id,
        action: action === "approve" ? "user.approve" : "user.deny",
        targetType: "user",
        targetId: id,
        metadata: JSON.stringify({ email: user.email, department: user.department }),
      },
    }),
  ]);

  return NextResponse.json({ ok: true, status: newStatus });
}
