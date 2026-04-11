"use client";

import { useEffect, useState } from "react";
import { Megaphone, Trash2, Loader2, Eye, MousePointerClick, X as XIcon, Users } from "lucide-react";
import DepartmentMultiSelect, { describeTargets } from "@/components/admin/DepartmentMultiSelect";

type CommStats = {
  usersReached: number;
  totalImpressions: number;
  totalDismissals: number;
  totalCtaClicks: number;
};

type Comm = {
  id: string;
  heading: string;
  details: string;
  ctaText: string | null;
  ctaUrl: string | null;
  active: boolean;
  targetDepartments: string[];
  createdAt: string;
  stats: CommStats;
};

export default function CommsClient() {
  const [comms, setComms] = useState<Comm[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [heading, setHeading] = useState("");
  const [details, setDetails] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/comms", { cache: "no-store" });
      const d = await r.json();
      setComms(d.comms || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!heading.trim() || !details.trim()) {
      setError("Heading and details are required");
      return;
    }
    if ((ctaText.trim() && !ctaUrl.trim()) || (ctaUrl.trim() && !ctaText.trim())) {
      setError("CTA text and link must be provided together (or leave both blank)");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/admin/comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heading: heading.trim(),
          details: details.trim(),
          ctaText: ctaText.trim() || null,
          ctaUrl: ctaUrl.trim() || null,
          active: true,
          targetDepartments,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Failed to create comm");
        return;
      }
      setHeading("");
      setDetails("");
      setCtaText("");
      setCtaUrl("");
      setTargetDepartments([]);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    const r = await fetch(`/api/admin/comms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (r.ok) await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this comm? This cannot be undone.")) return;
    const r = await fetch(`/api/admin/comms/${id}`, { method: "DELETE" });
    if (r.ok) await load();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-condensed uppercase tracking-wider text-vand-sand flex items-center gap-2">
          <Megaphone size={22} className="text-vand-gold" /> Generate Comms
        </h1>
        <p className="text-sm text-vand-sand/60 mt-1">
          Send a popup message to learners on the home screen. Each learner sees an active
          comm up to 3 times across 3 separate logins. Only one comm can be active at a
          time — activating a new comm will deactivate any other active comm.
        </p>
      </div>

      {/* Create form */}
      <form
        onSubmit={handleCreate}
        className="bg-white/5 border border-white/10 rounded-lg p-5 mb-8 space-y-4"
      >
        <h2 className="text-sm font-condensed uppercase tracking-wider text-vand-gold">
          New Comm
        </h2>

        <Field label="Heading *">
          <input
            type="text"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            maxLength={100}
            required
            className="w-full bg-vand-black border border-white/15 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/60"
          />
        </Field>

        <Field label="Details *">
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            rows={4}
            required
            className="w-full bg-vand-black border border-white/15 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/60 resize-y"
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Call to Action (optional)">
            <input
              type="text"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              maxLength={50}
              placeholder="e.g. Learn more"
              className="w-full bg-vand-black border border-white/15 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/60"
            />
          </Field>
          <Field label="Link (optional)">
            <input
              type="url"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="https://…"
              className="w-full bg-vand-black border border-white/15 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/60"
            />
          </Field>
        </div>

        <p className="text-[11px] text-vand-sand/40">
          Leave both CTA fields blank to show only a &ldquo;Got it&rdquo; close button.
        </p>

        <Field label="Audience">
          <DepartmentMultiSelect
            value={targetDepartments}
            onChange={setTargetDepartments}
          />
          <p className="text-[11px] text-vand-sand/40 mt-1.5">
            Select ALL STAFF to show this to everyone, or pick specific departments.
          </p>
        </Field>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-xs font-bold px-4 py-2 rounded hover:bg-vand-highlight disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
            Publish Comm
          </button>
        </div>
      </form>

      {/* List */}
      <h2 className="text-sm font-condensed uppercase tracking-wider text-vand-sand/60 mb-3">
        All Comms ({comms.length})
      </h2>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-vand-gold" />
        </div>
      ) : comms.length === 0 ? (
        <div className="text-center text-sm text-vand-sand/40 py-12 border border-dashed border-white/10 rounded">
          No comms yet. Create one above to broadcast it to learners.
        </div>
      ) : (
        <div className="space-y-3">
          {comms.map((c) => (
            <CommRow
              key={c.id}
              comm={c}
              onToggle={(active) => toggleActive(c.id, active)}
              onDelete={() => handleDelete(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-condensed uppercase tracking-wider text-vand-sand/60 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function CommRow({
  comm,
  onToggle,
  onDelete,
}: {
  comm: Comm;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}) {
  const created = new Date(comm.createdAt).toLocaleString();
  return (
    <div
      className={`bg-white/5 border rounded-lg p-4 ${
        comm.active ? "border-vand-gold/40" : "border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-condensed ${
                comm.active
                  ? "bg-vand-gold/20 text-vand-gold border border-vand-gold/30"
                  : "bg-white/5 text-vand-sand/40 border border-white/10"
              }`}
            >
              {comm.active ? "Active" : "Inactive"}
            </span>
            <span className="text-[10px] text-vand-sand/40">{created}</span>
          </div>
          <h3 className="text-vand-sand font-medium">{comm.heading}</h3>
          <p className="text-sm text-vand-sand/60 mt-1 whitespace-pre-wrap break-words">
            {comm.details}
          </p>
          {comm.ctaText && comm.ctaUrl && (
            <div className="mt-2 text-[11px] text-vand-gold/80">
              CTA: <span className="font-medium">{comm.ctaText}</span> →{" "}
              <span className="font-mono">{comm.ctaUrl}</span>
            </div>
          )}
          <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-vand-sand/60 bg-white/5 border border-white/10 rounded px-2 py-0.5">
            <Users size={10} />
            <span>Audience: {describeTargets(comm.targetDepartments)}</span>
          </div>

          {/* Engagement stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <Stat
              icon={<Eye size={12} />}
              label="Users reached"
              value={comm.stats.usersReached}
            />
            <Stat
              icon={<Eye size={12} />}
              label="Impressions"
              value={comm.stats.totalImpressions}
            />
            <Stat
              icon={<XIcon size={12} />}
              label="Dismissals"
              value={comm.stats.totalDismissals}
            />
            <Stat
              icon={<MousePointerClick size={12} />}
              label="CTA clicks"
              value={comm.stats.totalCtaClicks}
            />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <ToggleSwitch active={comm.active} onChange={onToggle} />
          <button
            onClick={onDelete}
            aria-label="Delete comm"
            className="p-1.5 text-vand-sand/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-condensed uppercase tracking-wider text-vand-sand/50">
        {icon}
        {label}
      </div>
      <div className="text-lg text-vand-sand font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function ToggleSwitch({
  active,
  onChange,
}: {
  active: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        active ? "bg-vand-gold" : "bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          active ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
