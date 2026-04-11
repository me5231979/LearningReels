import { requireAdmin, isSuperAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireAdmin();
  if (!me) return null;

  const users = await prisma.user.findMany({
    where: { status: { not: "pending_approval" } },
    orderBy: [{ deletedAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      jobTitle: true,
      department: true,
      points: true,
      streak: true,
      lastActiveAt: true,
      createdAt: true,
      deletedAt: true,
      _count: {
        select: { progress: true, reactions: true },
      },
    },
  });

  return (
    <UsersClient
      users={users.map((u) => ({
        ...u,
        lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        deletedAt: u.deletedAt?.toISOString() ?? null,
      }))}
      isSuperAdmin={isSuperAdminRole(me.role)}
      myId={me.id}
    />
  );
}
