import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { extractFromFile } from "@/lib/pdf/extract";
import { generateReelFromSource } from "@/lib/generate-from-source";
import type { BloomsLevel } from "@/types/course";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    const topicId = form.get("topicId");
    const bloomLevel = form.get("bloomLevel");
    const titleHint = form.get("title");
    const targetDepartmentsRaw = form.get("targetDepartments");
    let targetDepartments: string[] | undefined;
    if (typeof targetDepartmentsRaw === "string" && targetDepartmentsRaw) {
      try {
        const parsed = JSON.parse(targetDepartmentsRaw);
        if (Array.isArray(parsed)) {
          targetDepartments = parsed.filter(
            (d): d is string => typeof d === "string"
          );
        }
      } catch {}
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (typeof topicId !== "string" || typeof bloomLevel !== "string") {
      return NextResponse.json({ error: "Missing topicId or bloomLevel" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const extracted = await extractFromFile(buf, file.name, file.type);

    if (!extracted.text || extracted.text.length < 200) {
      return NextResponse.json(
        { error: "Could not extract enough text from the file (need at least 200 chars)" },
        { status: 400 }
      );
    }

    const result = await generateReelFromSource({
      topicId,
      bloomLevel: bloomLevel as BloomsLevel,
      body: extracted.text,
      titleHint: typeof titleHint === "string" ? titleHint : undefined,
      sourceType: "upload",
      sourceLabel: file.name,
      generatedById: me.id,
      generatedByName: me.name,
      originalBuffer: buf,
      originalFilename: file.name,
      targetDepartments,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("Upload generation failed:", e);
    return NextResponse.json(
      { error: (e as Error).message || "Generation failed" },
      { status: 500 }
    );
  }
}
