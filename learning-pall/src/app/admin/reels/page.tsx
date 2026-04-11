import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ReelsClient from "./ReelsClient";

export const dynamic = "force-dynamic";

export default async function ReelsAdminPage() {
  const me = await requireAdmin();
  if (!me) return null;

  const [reels, topics] = await Promise.all([
    prisma.learningReel.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        summary: true,
        bloomLevel: true,
        status: true,
        isFeatured: true,
        createdAt: true,
        topic: { select: { id: true, slug: true, label: true } },
        _count: { select: { progress: true, reactions: true, reports: true } },
        reactions: {
          where: { thumbs: { not: null } },
          select: { thumbs: true },
        },
      },
    }),
    prisma.topic.findMany({
      where: { isActive: true },
      orderBy: { label: "asc" },
      select: { id: true, slug: true, label: true },
    }),
  ]);

  const shaped = reels.map((r) => {
    const up = r.reactions.filter((x) => x.thumbs === "up").length;
    const down = r.reactions.filter((x) => x.thumbs === "down").length;
    return {
      id: r.id,
      title: r.title,
      summary: r.summary,
      bloomLevel: r.bloomLevel,
      status: r.status,
      isFeatured: r.isFeatured,
      createdAt: r.createdAt.toISOString(),
      topic: r.topic,
      completions: r._count.progress,
      reportCount: r._count.reports,
      thumbsUp: up,
      thumbsDown: down,
    };
  });

  return <ReelsClient reels={shaped} topics={topics} />;
}
