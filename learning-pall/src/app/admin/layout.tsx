import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AdminShell from "./AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  if (!user) redirect("/home");

  return (
    <AdminShell
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as "admin" | "super_admin",
      }}
    >
      {children}
    </AdminShell>
  );
}
