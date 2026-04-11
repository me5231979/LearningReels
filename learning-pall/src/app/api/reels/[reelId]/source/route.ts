import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reelId: string }> }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { reelId } = await params;
  const source = await prisma.reelSource.findUnique({ where: { reelId } });
  if (!source || !existsSync(source.brandedPdfPath)) {
    return NextResponse.json({ error: "No source archived" }, { status: 404 });
  }

  const data = await readFile(source.brandedPdfPath);
  return new NextResponse(data as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="learning-reel-source.pdf"`,
    },
  });
}
