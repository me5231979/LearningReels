import { requireAdmin } from "@/lib/auth";
import CommsClient from "./CommsClient";

export const dynamic = "force-dynamic";

export default async function CommsPage() {
  const me = await requireAdmin();
  if (!me) return null;
  return <CommsClient />;
}
