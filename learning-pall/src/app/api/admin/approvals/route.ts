import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    where: { status: "pending_approval", deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      department: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
  });
}
