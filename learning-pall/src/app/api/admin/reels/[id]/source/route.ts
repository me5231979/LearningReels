import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { renderBrandedPdf } from "@/lib/pdf/branded";
import type { BloomsLevel } from "@/types/course";

/**
 * Serve the branded source PDF for a reel.
 *
 * Dev: the PDF may have been archived to disk at ReelSource.brandedPdfPath.
 * Prod (Vercel): the filesystem is read-only, so nothing was ever written
 * there. Instead, regenerate the branded PDF in memory from the stored
 * `extractedText` on every request. It's admin-only and infrequent.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const source = await prisma.reelSource.findUnique({ where: { reelId: id } });
  if (!source) {
    return NextResponse.json({ error: "No source archived" }, { status: 404 });
  }

  // Fast path: archived file exists on disk (local dev)
  if (source.brandedPdfPath && existsSync(source.brandedPdfPath)) {
    try {
      const data = await readFile(source.brandedPdfPath);
      return new NextResponse(data as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="reel-${id}-source.pdf"`,
        },
      });
    } catch {
      // fall through to regenerate
    }
  }

  // Regenerate path: no archived file (Vercel prod). Rebuild from DB state.
  if (!source.extractedText) {
    return NextResponse.json(
      { error: "No archived text for this reel's source." },
      { status: 404 }
    );
  }

  const reel = await prisma.learningReel.findUnique({
    where: { id },
    include: {
      topic: true,
      createdBy: { select: { name: true } },
    },
  });
  if (!reel) {
    return NextResponse.json({ error: "Reel not found" }, { status: 404 });
  }

  const sourceLabel =
    source.originalName ||
    source.originalUrl ||
    (source.sourceType === "text" ? "Pasted text" : "Source material");

  try {
    const buf = await renderBrandedPdf({
      reelTitle: reel.title,
      topic: reel.topic.label,
      bloomLevel: reel.bloomLevel as BloomsLevel,
      generatedAt: reel.createdAt,
      generatedBy: reel.createdBy?.name || "Vanderbilt Learning Reels",
      sourceType: (source.sourceType as "upload" | "url" | "text") || "text",
      sourceLabel,
      body: source.extractedText,
      summary: reel.summary || undefined,
    });

    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="reel-${id}-source.pdf"`,
      },
    });
  } catch (e) {
    console.error("[admin:source] branded PDF regenerate failed:", e);
    return NextResponse.json(
      { error: "Could not render source PDF." },
      { status: 500 }
    );
  }
}
