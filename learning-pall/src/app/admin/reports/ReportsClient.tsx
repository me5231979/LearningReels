"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, ThumbsDown, Flag, MessageSquare, Send, Loader2, ExternalLink } from "lucide-react";

type Report = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  reel: { id: string; title: string; topic: string };
  resolution: string | null;
  resolvedAt: string | null;
  resolverName: string | null;
};

type Thumb = {
  id: string;
  updatedAt: string;
  user: { id: string; name: string; email: string };
  reel: { id: string; title: string; topic: string };
};

export default function ReportsClient({
  reports: initialReports,
  thumbs,
}: {
  reports: Report[];
  thumbs: Thumb[];
}) {
  const [tab, setTab] = useState<"reports" | "thumbs">("reports");
  const [reports, setReports] = useState(initialReports);
  const [resolveId, setResolveId] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    }
  }

  async function saveResolution(id: string, resolution: string, status: string) {
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution }),
    });
    if (!res.ok) {
      alert("Failed to send resolution");
      return false;
    }
    setReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              resolution,
              resolvedAt: new Date().toISOString(),
              resolverName: r.resolverName ?? "You",
            }
          : r
      )
    );
    return true;
  }

  const activeReport = reports.find((r) => r.id === resolveId) ?? null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-condensed uppercase tracking-wider text-vand-sand">Reports & Reactions</h1>
        <p className="text-sm text-vand-sand/60 mt-1">Super admin-only inbox</p>
      </div>

      <div className="flex border-b border-white/10 mb-5 overflow-x-auto">
        <TabBtn active={tab === "reports"} onClick={() => setTab("reports")}>
          <Flag size={12} /> Content reports ({reports.filter((r) => r.status === "open").length})
        </TabBtn>
        <TabBtn active={tab === "thumbs"} onClick={() => setTab("thumbs")}>
          <ThumbsDown size={12} /> Thumbs down ({thumbs.length})
        </TabBtn>
      </div>

      {tab === "reports" && (
        <div className="space-y-2">
          {reports.length === 0 && (
            <div className="text-center text-sm text-vand-sand/40 py-12">No content reports.</div>
          )}
          {reports.map((r) => (
            <div key={r.id} className={`bg-white/5 border rounded p-4 ${r.status === "open" ? "border-vand-gold/30" : "border-white/10 opacity-80"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-vand-gold/20 text-vand-gold border border-vand-gold/30 font-condensed">
                      {r.reason}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-vand-sand/40">{r.status}</span>
                    {r.resolution && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-condensed">
                        <MessageSquare size={10} /> Responded
                      </span>
                    )}
                  </div>
                  <Link href={`/admin/reels/${r.reel.id}`} className="inline-flex items-center gap-1 text-vand-sand hover:text-vand-gold font-medium group">
                    {r.reel.title}
                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                  </Link>
                  <div className="text-[11px] text-vand-sand/40 mt-1">
                    {r.reel.topic} · reported by {r.user.name} ({r.user.email}) · {timeAgo(r.createdAt)}
                  </div>
                  {r.details && (
                    <div className="text-xs text-vand-sand/70 mt-2 italic">&ldquo;{r.details}&rdquo;</div>
                  )}
                  {r.resolution && (
                    <div className="mt-3 border-l-2 border-emerald-500/40 pl-3 py-1">
                      <div className="text-[10px] font-condensed uppercase tracking-wider text-emerald-300/80 mb-0.5">
                        Response {r.resolverName ? `from ${r.resolverName}` : ""} · {r.resolvedAt ? timeAgo(r.resolvedAt) : ""}
                      </div>
                      <div className="text-xs text-vand-sand/80 whitespace-pre-wrap">{r.resolution}</div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title={r.resolution ? "Edit response" : "Respond to flagger"}
                    onClick={() => setResolveId(r.id)}
                    className="p-1.5 rounded hover:bg-white/10 text-vand-sand/60 hover:text-vand-gold"
                  >
                    <MessageSquare size={14} />
                  </button>
                  {r.status === "open" && (
                    <>
                      <button
                        title="Mark reviewed"
                        onClick={() => setStatus(r.id, "reviewed")}
                        className="p-1.5 rounded hover:bg-white/10 text-vand-sand/60 hover:text-emerald-400"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        title="Dismiss"
                        onClick={() => setStatus(r.id, "dismissed")}
                        className="p-1.5 rounded hover:bg-white/10 text-vand-sand/60 hover:text-red-400"
                      >
                        <X size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "thumbs" && (
        <div className="space-y-2">
          {thumbs.length === 0 && (
            <div className="text-center text-sm text-vand-sand/40 py-12">No thumbs-downs yet.</div>
          )}
          {thumbs.map((t) => (
            <div key={t.id} className="bg-white/5 border border-white/10 rounded p-4">
              <Link href={`/admin/reels/${t.reel.id}`} className="text-vand-sand hover:text-vand-gold font-medium">
                {t.reel.title}
              </Link>
              <div className="text-[11px] text-vand-sand/40 mt-1">
                {t.reel.topic} · {t.user.name} ({t.user.email}) · {timeAgo(t.updatedAt)}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeReport && (
        <ResolveModal
          report={activeReport}
          onClose={() => setResolveId(null)}
          onSend={async (text, status) => {
            const ok = await saveResolution(activeReport.id, text, status);
            if (ok) setResolveId(null);
          }}
        />
      )}
    </div>
  );
}

function ResolveModal({
  report,
  onClose,
  onSend,
}: {
  report: Report;
  onClose: () => void;
  onSend: (text: string, status: string) => void | Promise<void>;
}) {
  const [text, setText] = useState(report.resolution ?? "");
  const [status, setStatus] = useState(report.status === "open" ? "reviewed" : report.status);
  const [sending, setSending] = useState(false);

  async function submit() {
    if (text.trim().length === 0) {
      alert("Please write a response before sending.");
      return;
    }
    setSending(true);
    await onSend(text.trim(), status);
    setSending(false);
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-vand-black border border-white/15 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-sm font-condensed uppercase tracking-wider text-vand-sand">Respond to flagger</h2>
            <p className="text-[11px] text-vand-sand/50 mt-1 truncate">
              To {report.user.name} &middot; {report.reel.title}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded hover:bg-white/10 text-vand-sand/60 hover:text-vand-sand shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="rounded border border-white/10 bg-white/5 p-3 text-xs text-vand-sand/70">
            <div className="text-[10px] font-condensed uppercase tracking-wider text-vand-sand/40 mb-1">
              Their report ({report.reason})
            </div>
            {report.details ? <div className="italic">&ldquo;{report.details}&rdquo;</div> : <div className="text-vand-sand/40">No details provided.</div>}
          </div>

          <div>
            <label className="block text-[10px] font-condensed uppercase tracking-wider text-vand-sand/50 mb-1.5">
              Your response
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Thanks for flagging this — here&rsquo;s what we did…"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand placeholder:text-vand-sand/30 focus:outline-none focus:border-vand-gold/50 resize-y"
            />
            <p className="text-[10px] text-vand-sand/40 mt-1">
              The flagger will see this in their profile &ldquo;My reports&rdquo; section.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-condensed uppercase tracking-wider text-vand-sand/50 mb-1.5">
              Set status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50"
            >
              <option value="reviewed">Reviewed</option>
              <option value="actioned">Actioned (we changed the reel)</option>
              <option value="dismissed">Dismissed</option>
              <option value="open">Leave open</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-2 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-vand-sand/60 hover:text-vand-sand"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={sending || text.trim().length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-vand-gold text-vand-black text-xs font-semibold rounded hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {report.resolution ? "Update response" : "Send response"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-condensed uppercase tracking-wider border-b-2 transition-colors ${
        active ? "border-vand-gold text-vand-gold" : "border-transparent text-vand-sand/50 hover:text-vand-sand"
      }`}
    >
      {children}
    </button>
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
  return `${days}d ago`;
}
