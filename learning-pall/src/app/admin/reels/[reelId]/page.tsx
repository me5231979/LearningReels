import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ReelEditor from "./ReelEditor";

export const dynamic = "force-dynamic";

export default async function EditReelPage({
  params,
}: {
  params: Promise<{ reelId: string }>;
}) {
  const me = await requireAdmin();
  if (!me) return null;

  const { reelId } = await params;
  const reel = await prisma.learningReel.findUnique({
    where: { id: reelId },
    include: {
      cards: { orderBy: { order: "asc" } },
      topic: { select: { label: true, slug: true } },
      source: true,
      _count: { select: { progress: true, reactions: true, reports: true } },
    },
  });

  if (!reel) notFound();

  return (
    <ReelEditor
      reel={{
        id: reel.id,
        title: reel.title,
        summary: reel.summary,
        bloomLevel: reel.bloomLevel,
        status: reel.status,
        sourceCredit: reel.sourceCredit,
        sourceUrl: reel.sourceUrl,
        topicLabel: reel.topic.label,
        topicSlug: reel.topic.slug,
        completions: reel._count.progress,
        reportCount: reel._count.reports,
        hasArchivedSource: !!reel.source,
        cards: reel.cards.map((c) => ({
          id: c.id,
          order: c.order,
          cardType: c.cardType,
          title: c.title,
          script: c.script,
          quizJson: c.quizJson,
        })),
      }}
    />
  );
}
