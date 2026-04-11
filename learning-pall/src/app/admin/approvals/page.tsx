import { requireAdmin } from "@/lib/auth";
import ApprovalsClient from "./ApprovalsClient";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const me = await requireAdmin();
  if (!me) return null;
  return <ApprovalsClient />;
}
