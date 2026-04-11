import { requireAdmin, isSuperAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const me = await requireAdmin();
  if (!me) return null;

  if (!isSuperAdminRole(me.role)) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-condensed uppercase tracking-wider text-vand-sand">Reports</h1>
        <p className="text-sm text-vand-sand/60 mt-3">
          Content reports and learner reactions are visible to the super admin only.
        </p>
      </div>
    );
  }

  const [reports, thumbs] = await Promise.all([
    prisma.contentReport.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true } },
        reel: { select: { id: true, title: true, topic: { select: { label: true } } } },
      },
    }),
    prisma.userReaction.findMany({
      where: { thumbs: "down" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
        reel: { select: { id: true, title: true, topic: { select: { label: true } } } },
      },
    }),
  ]);

  // Lookup resolver names for any reports that have a response
  const resolverIds = Array.from(
    new Set(reports.map((r) => r.resolvedById).filter((id): id is string => !!id))
  );
  const resolvers = resolverIds.length
    ? await prisma.user.findMany({
        where: { id: { in: resolverIds } },
        select: { id: true, name: true },
      })
    : [];
  const resolverName = new Map(resolvers.map((u) => [u.id, u.name]));

  return (
    <ReportsClient
      reports={reports.map((r) => ({
        id: r.id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        user: r.user,
        reel: { id: r.reel.id, title: r.reel.title, topic: r.reel.topic.label },
        resolution: r.resolution,
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
        resolverName: r.resolvedById ? resolverName.get(r.resolvedById) ?? null : null,
      }))}
      thumbs={thumbs.map((t) => ({
        id: t.id,
        updatedAt: t.updatedAt.toISOString(),
        user: t.user,
        reel: { id: t.reel.id, title: t.reel.title, topic: t.reel.topic.label },
      }))}
    />
  );
}
