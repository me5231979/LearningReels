import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import GenerateClient from "./GenerateClient";

export const dynamic = "force-dynamic";

export default async function GeneratePage() {
  const me = await requireAdmin();
  if (!me) return null;

  const topics = await prisma.topic.findMany({
    where: { isActive: true },
    orderBy: { label: "asc" },
    select: { id: true, slug: true, label: true, category: true },
  });

  return <GenerateClient topics={topics} />;
}
