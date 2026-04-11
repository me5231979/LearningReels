import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Database from "better-sqlite3";
import { existsSync } from "fs";
import path from "path";

function getRawDb() {
  const candidates = [
    path.join(process.cwd(), "data", "learning-pall.db"),
    path.join(process.cwd(), "learning-pall", "data", "learning-pall.db"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return new Database(p);
  }
  return new Database("/Users/estesm4/Desktop/Learning Pall/learning-pall/data/learning-pall.db");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requireSuperAdmin();
  if (!me) return NextResponse.json({ error: "Super admin only" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { status, resolution } = body as { status?: string; resolution?: string };

  if (status && !["open", "reviewed", "dismissed", "actioned"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Use a transaction so status and resolution land together.
  if (status) {
    await prisma.contentReport.update({
      where: { id },
      data: { status, reviewedAt: status === "open" ? null : new Date() },
    });
  }

  // resolution is written via raw SQL because the Prisma client cache may not
  // yet know about the new columns in dev.
  if (typeof resolution === "string") {
    const trimmed = resolution.trim();
    try {
      const db = getRawDb();
      if (trimmed.length === 0) {
        db.prepare(
          `UPDATE ContentReport SET resolution = NULL, resolvedAt = NULL, resolvedById = NULL, resolutionReadAt = NULL WHERE id = ?`
        ).run(id);
      } else {
        db.prepare(
          `UPDATE ContentReport SET resolution = ?, resolvedAt = ?, resolvedById = ?, resolutionReadAt = NULL WHERE id = ?`
        ).run(trimmed, new Date().toISOString(), me.id, id);
      }
      db.close();
    } catch (e) {
      console.error("Failed to update report resolution:", e);
      return NextResponse.json({ error: "Failed to save resolution" }, { status: 500 });
    }
  }

  await prisma.adminAction.create({
    data: {
      actorId: me.id,
      action: "report.resolve",
      targetType: "report",
      targetId: id,
      metadata: JSON.stringify({
        status: status ?? null,
        hasResolution: typeof resolution === "string" && resolution.trim().length > 0,
      }),
    },
  });

  return NextResponse.json({ ok: true });
}
