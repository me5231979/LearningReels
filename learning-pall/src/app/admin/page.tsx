import Link from "next/link";
import { requireAdmin, isSuperAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Users, Film, ThumbsDown, Flag, Sparkles } from "lucide-react";
import UserActivityDrilldown, { type DashboardUser } from "./UserActivityDrilldown";

export const dynamic = "force-dynamic";

async function getStats() {
  const [users, reels, thumbsDown, openReports, totalCompletions] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.learningReel.count({ where: { status: "published" } }),
    prisma.userReaction.count({ where: { thumbs: "down" } }),
    prisma.contentReport.count({ where: { status: "open" } }),
    prisma.userProgress.count({ where: { status: "completed" } }),
  ]);
  return { users, reels, thumbsDown, openReports, totalCompletions };
}

async function getRecentThumbsDown(limit = 6) {
  const rows = await prisma.userReaction.findMany({
    where: { thumbs: "down" },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, email: true } },
      reel: { select: { id: true, title: true, topicId: true } },
    },
  });
  // Filter out orphaned reactions (reel deleted)
  return rows.filter((r) => r.reel && r.user);
}

async function getDashboardUsers(limit = 25): Promise<DashboardUser[]> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ lastActiveAt: "desc" }],
    take: limit,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      jobTitle: true,
      department: true,
      points: true,
      streak: true,
      lastActiveAt: true,
    },
  });

  // Pull completed counts in a single grouped query
  const completed = await prisma.userProgress.groupBy({
    by: ["userId"],
    where: {
      userId: { in: users.map((u) => u.id) },
      status: "completed",
    },
    _count: { _all: true },
  });
  const countMap = new Map(completed.map((c) => [c.userId, c._count._all]));

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    jobTitle: u.jobTitle,
    department: u.department,
    points: u.points,
    streak: u.streak,
    lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
    completions: countMap.get(u.id) ?? 0,
  }));
}

async function getRecentReports(limit = 6) {
  const rows = await prisma.contentReport.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, email: true } },
      reel: { select: { id: true, title: true } },
    },
  });
  // Filter out orphaned reports (reel deleted)
  return rows.filter((r) => r.reel && r.user);
}

export default async function AdminDashboardPage() {
  const user = await requireAdmin();
  if (!user) return null;

  const isSuper = isSuperAdminRole(user.role);
  const stats = await getStats();
  const [thumbsDownItems, reportItems, dashboardUsers] = isSuper
    ? await Promise.all([getRecentThumbsDown(), getRecentReports(), getDashboardUsers()])
    : [[], [], [] as DashboardUser[]];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-condensed uppercase tracking-wider text-vand-sand">
          Dashboard
        </h1>
        <p className="text-sm text-vand-sand/60 mt-1">
          Welcome back, {user.name.split(" ")[0]}.
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <StatTile icon={Users} label="Active users" value={stats.users} />
        <StatTile icon={Film} label="Published reels" value={stats.reels} />
        <StatTile icon={Sparkles} label="Completions" value={stats.totalCompletions} />
        <StatTile icon={ThumbsDown} label="Thumbs down" value={stats.thumbsDown} />
        <StatTile icon={Flag} label="Open reports" value={stats.openReports} highlight={stats.openReports > 0} />
      </div>

      {isSuper && (
        <div className="mb-6">
          <UserActivityDrilldown users={dashboardUsers} />
        </div>
      )}

      {isSuper ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <NotificationList
            title="Recent thumbs-downs"
            empty="No thumbs-downs yet."
            href="/admin/reports?tab=thumbs"
          >
            {thumbsDownItems.length === 0 ? null : (
              thumbsDownItems.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/reels/${r.reel.id}`} className="text-sm text-vand-sand truncate hover:text-vand-gold block">
                      {r.reel.title}
                    </Link>
                    <div className="text-[11px] text-vand-sand/40 truncate">
                      {r.user.name} · {r.user.email}
                    </div>
                  </div>
                  <div className="text-[10px] text-vand-sand/40 ml-3 whitespace-nowrap">
                    {timeAgo(r.updatedAt)}
                  </div>
                </li>
              ))
            )}
          </NotificationList>

          <NotificationList
            title="Open content reports"
            empty="No open reports."
            href="/admin/reports"
          >
            {reportItems.length === 0 ? null : (
              reportItems.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/reels/${r.reel.id}`} className="text-sm text-vand-sand truncate hover:text-vand-gold block">
                      {r.reel.title}
                    </Link>
                    <div className="text-[11px] text-vand-sand/40 truncate">
                      <span className="text-vand-gold/70 uppercase">{r.reason}</span>
                      {" · "}
                      {r.user.name}
                    </div>
                  </div>
                  <div className="text-[10px] text-vand-sand/40 ml-3 whitespace-nowrap">
                    {timeAgo(r.createdAt)}
                  </div>
                </li>
              ))
            )}
          </NotificationList>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded p-6 text-sm text-vand-sand/60">
          Notifications and content reports are visible to the super admin only.
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded border p-4 ${highlight ? "bg-vand-gold/10 border-vand-gold/40" : "bg-white/5 border-white/10"}`}>
      <Icon size={16} className={highlight ? "text-vand-gold" : "text-vand-sand/60"} />
      <div className={`text-2xl font-condensed mt-2 ${highlight ? "text-vand-gold" : "text-vand-sand"}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] text-vand-sand/50 uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}

function NotificationList({
  title,
  empty,
  href,
  children,
}: {
  title: string;
  empty: string;
  href: string;
  children: React.ReactNode;
}) {
  const hasItems = !!children;
  return (
    <div className="bg-white/5 border border-white/10 rounded">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h2 className="text-xs font-condensed uppercase tracking-wider text-vand-sand/80">
          {title}
        </h2>
        <Link href={href} className="text-[10px] text-vand-gold/80 hover:text-vand-gold uppercase tracking-wider">
          View all →
        </Link>
      </div>
      <ul className="px-4">
        {hasItems ? children : <li className="py-6 text-center text-xs text-vand-sand/40">{empty}</li>}
      </ul>
    </div>
  );
}

function timeAgo(d: Date | string) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}
