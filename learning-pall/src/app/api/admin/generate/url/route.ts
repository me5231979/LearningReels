import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ingestUrl } from "@/lib/pdf/snapshot";
import { generateReelFromSource } from "@/lib/generate-from-source";
import type { BloomsLevel } from "@/types/course";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { url, topicId, bloomLevel, title, targetDepartments } = await req.json();
    if (!url || !topicId || !bloomLevel) {
      return NextResponse.json(
        { error: "url, topicId, bloomLevel required" },
        { status: 400 }
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only http(s) URLs are supported" }, { status: 400 });
    }

    const ingest = await ingestUrl(url);
    if (!ingest.text || ingest.text.length < 200) {
      return NextResponse.json(
        { error: "Scraped page did not contain enough text" },
        { status: 400 }
      );
    }

    const result = await generateReelFromSource({
      topicId,
      bloomLevel: bloomLevel as BloomsLevel,
      body: ingest.text,
      titleHint: typeof title === "string" && title ? title : ingest.title,
      sourceType: "url",
      sourceLabel: url,
      generatedById: me.id,
      generatedByName: me.name,
      snapshotPdfBuffer: ingest.pdfBuffer,
      originalUrl: url,
      targetDepartments: Array.isArray(targetDepartments)
        ? targetDepartments.filter((d: unknown): d is string => typeof d === "string")
        : undefined,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("URL generation failed:", e);
    return NextResponse.json(
      { error: (e as Error).message || "Generation failed" },
      { status: 500 }
    );
  }
}
