import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await requireSuperAdmin();
  if (!user) return NextResponse.json({ count: 0 }, { status: 403 });

  const count = await prisma.contentReport.count({ where: { status: "open" } });
  return NextResponse.json({ count });
}
