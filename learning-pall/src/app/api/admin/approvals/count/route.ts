import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ count: 0 }, { status: 403 });

  const count = await prisma.user.count({
    where: { status: "pending_approval", deletedAt: null },
  });
  return NextResponse.json({ count });
}
