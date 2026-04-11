import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { generateReelFromSource } from "@/lib/generate-from-source";
import type { BloomsLevel } from "@/types/course";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { text, topicId, bloomLevel, title, targetDepartments } = await req.json();
    if (!text || !topicId || !bloomLevel) {
      return NextResponse.json(
        { error: "text, topicId, bloomLevel required" },
        { status: 400 }
      );
    }
    if (text.length < 200) {
      return NextResponse.json(
        { error: "Need at least 200 chars of text" },
        { status: 400 }
      );
    }

    const result = await generateReelFromSource({
      topicId,
      bloomLevel: bloomLevel as BloomsLevel,
      body: text,
      titleHint: typeof title === "string" && title ? title : undefined,
      sourceType: "text",
      sourceLabel: "Pasted text",
      generatedById: me.id,
      generatedByName: me.name,
      targetDepartments: Array.isArray(targetDepartments)
        ? targetDepartments.filter((d: unknown): d is string => typeof d === "string")
        : undefined,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("Text generation failed:", e);
    return NextResponse.json(
      { error: (e as Error).message || "Generation failed" },
      { status: 500 }
    );
  }
}
