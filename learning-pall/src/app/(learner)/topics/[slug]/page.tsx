import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import TopicClient from "./TopicClient";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login");

  const { slug } = await params;

  return <TopicClient categorySlug={slug} userId={session.uid} />;
}
