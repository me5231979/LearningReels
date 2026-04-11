import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const source = await prisma.reelSource.findUnique({ where: { reelId: id } });
  if (!source || !existsSync(source.brandedPdfPath)) {
    return NextResponse.json({ error: "No source archived" }, { status: 404 });
  }

  const data = await readFile(source.brandedPdfPath);
  return new NextResponse(data as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="reel-${id}-source.pdf"`,
    },
  });
}
