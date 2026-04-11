import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import Database from "better-sqlite3";
import { existsSync } from "fs";
import path from "path";

function getDb() {
  const candidates = [
    path.join(process.cwd(), "data", "learning-pall.db"),
    path.join(process.cwd(), "learning-pall", "data", "learning-pall.db"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return new Database(p);
  }
  return new Database("/Users/estesm4/Desktop/Learning Pall/learning-pall/data/learning-pall.db");
}

function generateId() {
  return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reelId: string }> }
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { reelId } = await params;
  const body = await request.json();
  const { thumbs, favorited } = body as {
    thumbs?: "up" | "down" | null;
    favorited?: boolean;
  };

  const db = getDb();

  const existing = db.prepare(
    "SELECT id, thumbs, favorited FROM UserReaction WHERE userId = ? AND reelId = ?"
  ).get(session.uid, reelId) as { id: string; thumbs: string | null; favorited: number } | undefined;

  let reaction;

  if (existing) {
    const updates: string[] = [];
    const values: unknown[] = [];
    if (thumbs !== undefined) { updates.push("thumbs = ?"); values.push(thumbs); }
    if (favorited !== undefined) { updates.push("favorited = ?"); values.push(favorited ? 1 : 0); }
    updates.push("updatedAt = datetime('now')");
    values.push(existing.id);
    db.prepare(`UPDATE UserReaction SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    reaction = {
      thumbs: thumbs !== undefined ? thumbs : existing.thumbs,
      favorited: favorited !== undefined ? favorited : !!existing.favorited,
    };
  } else {
    const id = generateId();
    db.prepare(
      "INSERT INTO UserReaction (id, userId, reelId, thumbs, favorited, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).run(id, session.uid, reelId, thumbs ?? null, favorited ? 1 : 0);
    reaction = { thumbs: thumbs ?? null, favorited: favorited ?? false };
  }

  db.close();
  return NextResponse.json({ reaction });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reelId: string }> }
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { reelId } = await params;
  const db = getDb();

  const row = db.prepare(
    "SELECT thumbs, favorited FROM UserReaction WHERE userId = ? AND reelId = ?"
  ).get(session.uid, reelId) as { thumbs: string | null; favorited: number } | undefined;

  db.close();

  return NextResponse.json({
    reaction: row ? { thumbs: row.thumbs, favorited: !!row.favorited } : { thumbs: null, favorited: false },
  });
}
