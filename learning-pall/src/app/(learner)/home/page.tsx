import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const session = await readSession();
  if (!session) redirect("/login");

  return <HomeClient userName={session.name || "Learner"} />;
}
