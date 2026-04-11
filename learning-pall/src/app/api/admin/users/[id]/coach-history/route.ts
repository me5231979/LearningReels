import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

type StoredMessage = { role: "user" | "assistant"; content: string; ts: number };

function parseMessages(raw: string | null | undefined): StoredMessage[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as StoredMessage[];
  } catch {}
  return [];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const conversations = await prisma.coachConversation.findMany({
    where: { userId: id },
    orderBy: { updatedAt: "desc" },
    include: {
      reel: {
        select: {
          id: true,
          title: true,
          topic: { select: { label: true, slug: true } },
        },
      },
    },
  });

  return NextResponse.json({
    user,
    conversations: conversations.map((c) => ({
      id: c.id,
      reelId: c.reel.id,
      reelTitle: c.reel.title,
      topicLabel: c.reel.topic.label,
      topicSlug: c.reel.topic.slug,
      turnsUsed: c.turnsUsed,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messages: parseMessages(c.messages),
    })),
  });
}
