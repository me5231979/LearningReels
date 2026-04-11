"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Trash2, ThumbsUp, ThumbsDown, Flag, Play, X, ArrowUp, ArrowDown, ArrowUpDown, Star } from "lucide-react";
import { useRouter } from "next/navigation";

type Reel = {
  id: string;
  title: string;
  summary: string;
  bloomLevel: string;
  status: string;
  isFeatured: boolean;
  createdAt: string;
  topic: { id: string; slug: string; label: string };
  completions: number;
  reportCount: number;
  thumbsUp: number;
  thumbsDown: number;
};

const NEW_REEL_DAYS = 14;
function isNewReel(createdAt: string): boolean {
  const ms = Date.now() - new Date(createdAt).getTime();
  return ms < NEW_REEL_DAYS * 24 * 60 * 60 * 1000;
}

type Topic = { id: string; slug: string; label: string };

type SortKey = "title" | "topic" | "bloomLevel" | "status" | "engagement" | "createdAt";

function skillLabel(bloom: string): string {
  const map: Record<string, string> = {
    remember: "Recall",
    understand: "Comprehend",
    apply: "Apply",
    analyze: "Analyze",
    evaluate: "Evaluate",
    create: "Create",
  };
  return map[bloom] || bloom;
}

export default function ReelsClient({ reels: initial, topics }: { reels: Reel[]; topics: Topic[] }) {
  const router = useRouter();
  const [reels, setReels] = useState(initial);
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" || key === "topic" ? "asc" : "desc");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = reels.filter((r) => {
      if (topicFilter && r.topic.id !== topicFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (featuredOnly && !r.isFeatured) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.summary.toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "title":
          av = a.title.toLowerCase();
          bv = b.title.toLowerCase();
          break;
        case "topic":
          av = a.topic.label.toLowerCase();
          bv = b.topic.label.toLowerCase();
          break;
        case "bloomLevel":
          av = a.bloomLevel;
          bv = b.bloomLevel;
          break;
        case "status":
          av = a.status;
          bv = b.status;
          break;
        case "engagement":
          av = a.completions + a.thumbsUp - a.thumbsDown;
          bv = b.completions + b.thumbsUp - b.thumbsDown;
          break;
        case "createdAt":
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [reels, query, topicFilter, statusFilter, featuredOnly, sortKey, sortDir]);

  async function toggleFeatured(id: string, next: boolean) {
    // optimistic
    setReels((prev) => prev.map((r) => (r.id === id ? { ...r, isFeatured: next } : r)));
    const res = await fetch(`/api/admin/reels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFeatured: next }),
    });
    if (!res.ok) {
      // revert
      setReels((prev) => prev.map((r) => (r.id === id ? { ...r, isFeatured: !next } : r)));
      alert("Failed to update featured state");
    }
  }

  async function del(id: string) {
    if (!confirm("Permanently delete this reel and all its cards/progress? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/reels/${id}`, { method: "DELETE" });
    if (res.ok) {
      setReels((prev) => prev.filter((r) => r.id !== id));
    } else {
      alert("Delete failed");
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-condensed uppercase tracking-wider text-vand-sand">Reels Library</h1>
          <p className="text-sm text-vand-sand/60 mt-1">{filtered.length} of {reels.length} reels</p>
        </div>
        <button
          onClick={() => router.push("/admin/generate")}
          className="px-4 py-2 bg-vand-gold text-vand-black text-sm font-semibold rounded hover:opacity-90 self-start sm:self-auto"
        >
          + Generate reel
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-vand-sand/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reels…"
            className="w-full bg-white/5 border border-white/10 rounded pl-9 pr-3 py-2 text-sm text-vand-sand placeholder:text-vand-sand/30 focus:outline-none focus:border-vand-gold/50"
          />
        </div>
        <div className="flex gap-2 sm:gap-3">
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50 min-w-0"
          >
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50 min-w-0"
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <button
            type="button"
            onClick={() => setFeaturedOnly((v) => !v)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-condensed uppercase tracking-wider border transition-colors ${
              featuredOnly
                ? "border-vand-gold/60 bg-vand-gold/15 text-vand-gold"
                : "border-white/10 bg-white/5 text-vand-sand/60 hover:text-vand-sand"
            }`}
            title="Show only featured reels"
          >
            <Star size={12} fill={featuredOnly ? "currentColor" : "none"} />
            Featured
          </button>
          <select
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":") as [SortKey, "asc" | "desc"];
              setSortKey(k);
              setSortDir(d);
            }}
            className="md:hidden flex-1 sm:flex-none bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50 min-w-0"
            aria-label="Sort"
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="title:asc">Title A→Z</option>
            <option value="title:desc">Title Z→A</option>
            <option value="topic:asc">Topic A→Z</option>
            <option value="engagement:desc">Most engagement</option>
            <option value="status:asc">Status</option>
          </select>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded p-6 text-center text-sm text-vand-sand/40">
            No reels match.
          </div>
        )}
        {filtered.map((r) => (
          <div key={r.id} className="bg-white/5 border border-white/10 rounded p-4">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/admin/reels/${r.id}`} className="text-vand-sand hover:text-vand-gold text-sm font-medium flex-1 min-w-0">
                {r.title}
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                {isNewReel(r.createdAt) && (
                  <span className="text-[9px] px-2 py-0.5 rounded uppercase font-condensed border border-vand-gold/40 bg-vand-gold/10 text-vand-gold">NEW</span>
                )}
                {r.isFeatured && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-2 py-0.5 rounded uppercase font-condensed border border-amber-400/40 bg-amber-400/10 text-amber-300">
                    <Star size={9} fill="currentColor" /> Featured
                  </span>
                )}
                <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-condensed border ${
                  r.status === "published"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : r.status === "draft"
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                    : "border-white/10 bg-white/5 text-vand-sand/40"
                }`}>
                  {r.status}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-vand-sand/50 mt-1 truncate">
              {r.topic.label} · {skillLabel(r.bloomLevel)}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-vand-sand/60 flex-wrap">
              <span>{r.completions} done</span>
              <span className="flex items-center gap-1"><ThumbsUp size={10} /> {r.thumbsUp}</span>
              <span className="flex items-center gap-1"><ThumbsDown size={10} /> {r.thumbsDown}</span>
              {r.reportCount > 0 && (
                <span className="flex items-center gap-1 text-vand-gold"><Flag size={10} /> {r.reportCount}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
              <button
                onClick={() => toggleFeatured(r.id, !r.isFeatured)}
                className={`px-3 py-1.5 rounded border ${
                  r.isFeatured
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                    : "border-white/10 text-vand-sand/60 hover:text-amber-300 hover:border-amber-400/30"
                }`}
                title={r.isFeatured ? "Unfeature" : "Feature"}
              >
                <Star size={14} fill={r.isFeatured ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => setPreviewId(r.id)}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-vand-gold border border-vand-gold/30 rounded hover:bg-vand-gold/10"
              >
                <Play size={12} /> View
              </button>
              <Link
                href={`/admin/reels/${r.id}`}
                className="flex-1 text-center px-2 py-1.5 text-xs text-vand-sand/80 border border-white/10 rounded hover:bg-white/5"
              >
                Edit
              </Link>
              <button
                onClick={() => del(r.id)}
                className="px-3 py-1.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white/5 border border-white/10 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/40 text-[10px] uppercase tracking-wider text-vand-sand/50">
            <tr>
              <SortTh label="Title" sortKey="title" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortTh label="Topic" sortKey="topic" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortTh label="Skill" sortKey="bloomLevel" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortTh label="Status" sortKey="status" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortTh label="Engagement" sortKey="engagement" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/admin/reels/${r.id}`} className="text-vand-sand hover:text-vand-gold">
                      {r.title}
                    </Link>
                    {isNewReel(r.createdAt) && (
                      <span className="text-[9px] px-2 py-0.5 rounded uppercase font-condensed border border-vand-gold/40 bg-vand-gold/10 text-vand-gold">NEW</span>
                    )}
                    {r.isFeatured && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-2 py-0.5 rounded uppercase font-condensed border border-amber-400/40 bg-amber-400/10 text-amber-300">
                        <Star size={9} fill="currentColor" /> Featured
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-vand-sand/60 text-xs">{r.topic.label}</td>
                <td className="px-4 py-3 text-vand-sand/60 text-xs uppercase">{skillLabel(r.bloomLevel)}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-condensed border ${
                    r.status === "published"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : r.status === "draft"
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                      : "border-white/10 bg-white/5 text-vand-sand/40"
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-vand-sand/60">
                  <div className="flex items-center gap-3">
                    <span>{r.completions} done</span>
                    <span className="flex items-center gap-1"><ThumbsUp size={11} /> {r.thumbsUp}</span>
                    <span className="flex items-center gap-1"><ThumbsDown size={11} /> {r.thumbsDown}</span>
                    {r.reportCount > 0 && (
                      <span className="flex items-center gap-1 text-vand-gold"><Flag size={11} /> {r.reportCount}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => toggleFeatured(r.id, !r.isFeatured)}
                      title={r.isFeatured ? "Unfeature" : "Feature"}
                      className={`p-1.5 rounded hover:bg-white/10 ${
                        r.isFeatured ? "text-amber-300" : "text-vand-sand/60 hover:text-amber-300"
                      }`}
                    >
                      <Star size={14} fill={r.isFeatured ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => setPreviewId(r.id)}
                      title="View reel"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-vand-gold hover:bg-vand-gold/10 rounded"
                    >
                      <Play size={12} /> View
                    </button>
                    <Link href={`/admin/reels/${r.id}`} className="px-2 py-1 text-xs text-vand-sand/60 hover:text-vand-gold rounded">Edit</Link>
                    <button onClick={() => del(r.id)} className="p-1.5 rounded hover:bg-white/10 text-vand-sand/60 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-vand-sand/40">No reels match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {previewId && <ReelPreviewModal reelId={previewId} onClose={() => setPreviewId(null)} />}
    </div>
  );
}

function SortTh({
  label,
  sortKey,
  current,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onClick: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th className="text-left px-4 py-2">
      <button
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-vand-gold transition-colors ${
          active ? "text-vand-gold" : ""
        }`}
      >
        {label}
        {active ? (
          dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />
        ) : (
          <ArrowUpDown size={10} className="opacity-40" />
        )}
      </button>
    </th>
  );
}

function ReelPreviewModal({ reelId, onClose }: { reelId: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-2 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] h-[90vh] sm:h-[85vh] bg-vand-black border border-white/10 rounded-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/70 text-vand-sand hover:bg-black/90"
          aria-label="Close preview"
        >
          <X size={16} />
        </button>
        <iframe
          src={`/admin/reels/${reelId}/preview`}
          className="w-full h-full border-0"
          title="Reel preview"
        />
      </div>
    </div>
  );
}
