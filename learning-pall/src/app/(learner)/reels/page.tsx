import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import ReelFeed from "@/components/reels/ReelFeed";

export default async function ReelsPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  // Check if user has been onboarded
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
  });
  if (user && !user.onboardedAt) {
    redirect("/onboarding");
  }

  return <ReelFeed userId={session.uid} />;
}
