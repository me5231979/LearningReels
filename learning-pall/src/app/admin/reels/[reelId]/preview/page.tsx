import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import PreviewClient from "./PreviewClient";

export const dynamic = "force-dynamic";

export default async function ReelPreviewPage({
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
      topic: true,
    },
  });
  if (!reel) notFound();

  const reelData = {
    id: reel.id,
    title: reel.title,
    summary: reel.summary,
    bloomLevel: reel.bloomLevel,
    estimatedSeconds: reel.estimatedSeconds,
    topicLabel: reel.topic.label,
    categoryLabel: reel.topic.category,
    sourceUrl: reel.sourceUrl,
    sourceCredit: reel.sourceCredit,
    coreCompetency: reel.coreCompetency,
    hasArchivedSource: false,
    cards: reel.cards.map((c) => ({
      id: c.id,
      order: c.order,
      cardType: c.cardType as "hook" | "narration" | "scenario" | "interaction" | "feedback",
      title: c.title,
      script: c.script,
      visualDescription: c.visualDescription,
      imageUrl: c.imageUrl,
      animationCue: c.animationCue,
      quizJson: c.quizJson,
      scenarioJson: c.scenarioJson,
      durationMs: c.durationMs,
    })),
  };

  return <PreviewClient reel={reelData} userId={me.id} status={reel.status} />;
}
