"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Flame,
  Trophy,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Star,
} from "lucide-react";

export type DashboardUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  jobTitle: string | null;
  department: string | null;
  points: number;
  streak: number;
  lastActiveAt: string | null;
  completions: number;
};

type Activity = {
  user: DashboardUser & { createdAt: string };
  stats: {
    completedCount: number;
    avgScore: number | null;
    dueReviews: number;
  };
  progress: Array<{
    id: string;
    reelId: string;
    reelTitle: string;
    topicLabel: string;
    status: string;
    score: number | null;
    completedAt: string | null;
  }>;
  reactions: Array<{
    id: string;
    reelId: string;
    reelTitle: string;
    thumbs: string | null;
    favorited: boolean;
    updatedAt: string;
  }>;
  bloomLevels: Array<{
    topicId: string;
    topicLabel: string;
    currentLevel: string;
    completions: number;
    avgScore: number;
  }>;
};

const SKILL_LABEL: Record<string, string> = {
  remember: "Recall",
  understand: "Comprehend",
  apply: "Apply",
  analyze: "Analyze",
  evaluate: "Evaluate",
  create: "Create",
};

type SortKey = "name" | "completions" | "points" | "streak" | "lastActiveAt";

export default function UserActivityDrilldown({ users }: { users: DashboardUser[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activity, setActivity] = useState<Record<string, Activity>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("lastActiveAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sorted = [...users].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    let av: string | number = "";
    let bv: string | number = "";
    switch (sortKey) {
      case "name":
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
        break;
      case "completions":
        av = a.completions;
        bv = b.completions;
        break;
      case "points":
        av = a.points;
        bv = b.points;
        break;
      case "streak":
        av = a.streak;
        bv = b.streak;
        break;
      case "lastActiveAt":
        av = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        bv = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        break;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  async function expand(userId: string) {
    if (expandedId === userId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(userId);
    if (activity[userId]) return;
    setLoadingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/activity`);
      if (res.ok) {
        const data: Activity = await res.json();
        setActivity((prev) => ({ ...prev, [userId]: data }));
      }
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h2 className="text-xs font-condensed uppercase tracking-wider text-vand-sand/80">
          User activity
        </h2>
        <Link
          href="/admin/users"
          className="text-[10px] text-vand-gold/80 hover:text-vand-gold uppercase tracking-wider"
        >
          Manage users →
        </Link>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-white/5">
        {sorted.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-vand-sand/40">No users yet.</div>
        )}
        {sorted.map((u) => {
          const open = expandedId === u.id;
          return (
            <div key={u.id}>
              <button
                onClick={() => expand(u.id)}
                className="w-full text-left px-4 py-3 flex items-start gap-2 hover:bg-white/[0.02]"
              >
                {open ? (
                  <ChevronDown size={14} className="text-vand-gold mt-0.5 shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-vand-sand/40 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-vand-sand truncate">{u.name}</div>
                  <div className="text-[10px] text-vand-sand/40 truncate">{u.email}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-vand-sand/60">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 size={10} /> {u.completions}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Trophy size={10} /> {u.points}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Flame size={10} /> {u.streak}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-vand-sand/40 whitespace-nowrap">
                  {u.lastActiveAt ? timeAgo(u.lastActiveAt) : "—"}
                </span>
              </button>
              {open && (
                <div className="px-4 pb-4 bg-black/30">
                  <DrilldownPanel
                    loading={loadingId === u.id}
                    activity={activity[u.id]}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-black/40 text-[10px] uppercase tracking-wider text-vand-sand/50">
            <tr>
              <th className="text-left px-4 py-2 w-6"></th>
              <SortHeader label="User" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
              <SortHeader label="Done" active={sortKey === "completions"} dir={sortDir} onClick={() => toggleSort("completions")} />
              <SortHeader label="Points" active={sortKey === "points"} dir={sortDir} onClick={() => toggleSort("points")} />
              <SortHeader label="Streak" active={sortKey === "streak"} dir={sortDir} onClick={() => toggleSort("streak")} />
              <SortHeader label="Last seen" active={sortKey === "lastActiveAt"} dir={sortDir} onClick={() => toggleSort("lastActiveAt")} />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-vand-sand/40">
                  No users yet.
                </td>
              </tr>
            )}
            {sorted.map((u) => {
              const open = expandedId === u.id;
              return (
                <Fragment key={u.id}>
                  <tr
                    onClick={() => expand(u.id)}
                    className="border-t border-white/5 cursor-pointer hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3">
                      {open ? (
                        <ChevronDown size={14} className="text-vand-gold" />
                      ) : (
                        <ChevronRight size={14} className="text-vand-sand/40" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-vand-sand">{u.name}</div>
                      <div className="text-[11px] text-vand-sand/40">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-vand-sand/70">{u.completions}</td>
                    <td className="px-4 py-3 text-vand-sand/70">{u.points.toLocaleString()}</td>
                    <td className="px-4 py-3 text-vand-sand/70">{u.streak}</td>
                    <td className="px-4 py-3 text-[11px] text-vand-sand/50">
                      {u.lastActiveAt ? timeAgo(u.lastActiveAt) : "—"}
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-black/30">
                      <td></td>
                      <td colSpan={5} className="px-4 pb-4 pt-1">
                        <DrilldownPanel
                          loading={loadingId === u.id}
                          activity={activity[u.id]}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="text-left px-4 py-2">
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-vand-gold transition-colors ${
          active ? "text-vand-gold" : ""
        }`}
      >
        {label}
        <span className="text-[8px]">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function DrilldownPanel({
  loading,
  activity,
}: {
  loading: boolean;
  activity: Activity | undefined;
}) {
  if (loading || !activity) {
    return (
      <div className="flex items-center gap-2 text-xs text-vand-sand/50 py-3">
        <Loader2 size={12} className="animate-spin" /> Loading activity…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
      {/* Stats column */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-vand-sand/50">Stats</div>
        <div className="text-xs text-vand-sand/80 space-y-1">
          <div>
            <span className="text-vand-sand/40">Completed: </span>
            {activity.stats.completedCount}
          </div>
          <div>
            <span className="text-vand-sand/40">Avg score: </span>
            {activity.stats.avgScore ?? "—"}
            {activity.stats.avgScore != null && "%"}
          </div>
          <div>
            <span className="text-vand-sand/40">Due reviews: </span>
            {activity.stats.dueReviews}
          </div>
          <div>
            <span className="text-vand-sand/40">Joined: </span>
            {new Date(activity.user.createdAt).toLocaleDateString()}
          </div>
        </div>
        {activity.bloomLevels.length > 0 && (
          <div className="pt-2">
            <div className="text-[10px] uppercase tracking-wider text-vand-sand/50 mb-1">
              Skills
            </div>
            <div className="space-y-1">
              {activity.bloomLevels.slice(0, 5).map((b) => (
                <div key={b.topicId} className="text-[11px] text-vand-sand/70">
                  <span className="text-vand-gold/80">{SKILL_LABEL[b.currentLevel] || b.currentLevel}</span>
                  <span className="text-vand-sand/40"> · </span>
                  <span>{b.topicLabel}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent reels column */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-vand-sand/50">Recent reels</div>
        {activity.progress.length === 0 ? (
          <div className="text-[11px] text-vand-sand/40">No activity yet.</div>
        ) : (
          <ul className="space-y-1">
            {activity.progress.slice(0, 6).map((p) => (
              <li key={p.id} className="text-[11px] flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 ${p.status === "completed" ? "text-emerald-400" : "text-vand-sand/40"}`}>
                  {p.status === "completed" ? "✓" : "○"}
                </span>
                <Link
                  href={`/admin/reels/${p.reelId}`}
                  className="flex-1 min-w-0 text-vand-sand/80 hover:text-vand-gold truncate"
                >
                  {p.reelTitle}
                  {p.score != null && (
                    <span className="text-vand-sand/40"> · {p.score}%</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Reactions column */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-vand-sand/50">Reactions</div>
        {activity.reactions.length === 0 ? (
          <div className="text-[11px] text-vand-sand/40">No reactions yet.</div>
        ) : (
          <ul className="space-y-1">
            {activity.reactions.slice(0, 6).map((r) => (
              <li key={r.id} className="text-[11px] flex items-center gap-2">
                {r.thumbs === "up" && <ThumbsUp size={10} className="text-emerald-400 shrink-0" />}
                {r.thumbs === "down" && <ThumbsDown size={10} className="text-red-400 shrink-0" />}
                {r.favorited && <Star size={10} className="text-vand-gold shrink-0" />}
                <Link
                  href={`/admin/reels/${r.reelId}`}
                  className="flex-1 min-w-0 text-vand-sand/80 hover:text-vand-gold truncate"
                >
                  {r.reelTitle}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function timeAgo(d: string) {
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
