"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Link as LinkIcon,
  Type,
  Loader2,
  FileText,
  CheckCircle2,
  Layers,
  Globe,
  AlertTriangle,
  Copy as CopyIcon,
} from "lucide-react";
import DepartmentMultiSelect from "@/components/admin/DepartmentMultiSelect";

type Topic = { id: string; slug: string; label: string; category: string };
type Mode = "upload" | "url" | "text" | "bulk";

type BulkItemStatus =
  | "pending"
  | "scraping"
  | "generating"
  | "done"
  | "duplicate"
  | "failed";
type BulkItem = {
  url: string;
  title: string;
  publication: string | null;
  status: BulkItemStatus;
  error?: string;
  reelId?: string;
  reelTitle?: string;
};
type BulkJobState = {
  id: string;
  phase: "queued" | "discovering" | "deduping" | "generating" | "done" | "failed";
  message: string;
  topicLabel: string;
  count: number;
  items: BulkItem[];
  error?: string;
};

export default function GenerateClient({ topics }: { topics: Topic[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("upload");
  const [topicId, setTopicId] = useState(topics[0]?.id || "");
  const [bloomLevel, setBloomLevel] = useState("understand");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<{ reelId: string; title: string } | null>(null);

  // Mode-specific state
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);

  // Bulk mode state
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkJob, setBulkJob] = useState<BulkJobState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll the bulk job until it terminates
  useEffect(() => {
    if (!bulkJob || bulkJob.phase === "done" || bulkJob.phase === "failed") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/admin/generate/bulk?jobId=${bulkJob.id}`);
        if (!r.ok) return;
        const next: BulkJobState = await r.json();
        setBulkJob(next);
      } catch {
        /* ignore — will retry */
      }
    }, 2500);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [bulkJob]);

  async function startBulk() {
    if (!topicId) {
      alert("Pick a topic");
      return;
    }
    setBusy(true);
    setStatus("Starting bulk discovery…");
    try {
      const res = await fetch("/api/admin/generate/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          bloomLevel,
          targetDepartments,
          count: bulkCount,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Failed to start bulk job");
        return;
      }
      const data = await res.json();
      // Seed initial state; the poll loop will pick it up.
      setBulkJob({
        id: data.jobId,
        phase: "queued",
        message: "Job queued",
        topicLabel: topics.find((t) => t.id === topicId)?.label || "",
        count: bulkCount,
        items: [],
      });
      setStatus("");
    } catch (e: unknown) {
      alert((e as Error).message || "Error");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (mode === "bulk") return; // bulk has its own start handler
    if (!topicId) {
      alert("Pick a topic");
      return;
    }
    setBusy(true);
    setStatus("Preparing source…");
    setResult(null);
    try {
      let res: Response;
      if (mode === "upload") {
        if (!file) {
          alert("Choose a file");
          setBusy(false);
          return;
        }
        const fd = new FormData();
        fd.append("file", file);
        fd.append("topicId", topicId);
        fd.append("bloomLevel", bloomLevel);
        if (title) fd.append("title", title);
        fd.append("targetDepartments", JSON.stringify(targetDepartments));
        setStatus("Uploading & extracting text…");
        res = await fetch("/api/admin/generate/upload", { method: "POST", body: fd });
      } else if (mode === "url") {
        if (!url) {
          alert("Enter a URL");
          setBusy(false);
          return;
        }
        setStatus("Scraping page & archiving snapshot…");
        res = await fetch("/api/admin/generate/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, topicId, bloomLevel, title, targetDepartments }),
        });
      } else {
        if (!text.trim()) {
          alert("Paste some text");
          setBusy(false);
          return;
        }
        setStatus("Generating reel from text…");
        res = await fetch("/api/admin/generate/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, topicId, bloomLevel, title, targetDepartments }),
        });
      }

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Generation failed");
        return;
      }
      const data = await res.json();
      setResult({ reelId: data.reelId, title: data.title });
      setStatus("");
      // Close the generator and return to the Reels Library so the new draft is
      // immediately visible alongside everything else.
      router.push(`/admin/reels?new=${data.reelId}`);
    } catch (e: unknown) {
      alert((e as Error).message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-condensed uppercase tracking-wider text-vand-sand">Generate Reel</h1>
        <p className="text-sm text-vand-sand/60 mt-1">
          Generate a learning reel from an uploaded document, a URL, or pasted text. The reel is created
          as a draft — review and approve it before pushing to learners. A branded source PDF is archived.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <ModeBtn active={mode === "upload"} onClick={() => setMode("upload")} icon={Upload} label="Upload" sub="PDF, DOCX, PPTX" />
        <ModeBtn active={mode === "url"} onClick={() => setMode("url")} icon={LinkIcon} label="Web URL" sub="Scrape + snapshot" />
        <ModeBtn active={mode === "text"} onClick={() => setMode("text")} icon={Type} label="Text" sub="Paste content" />
        <ModeBtn active={mode === "bulk"} onClick={() => setMode("bulk")} icon={Layers} label="Bulk" sub="Search web → 10 reels" />
      </div>

      {mode === "bulk" ? (
        <BulkPanel
          topics={topics}
          topicId={topicId}
          setTopicId={setTopicId}
          bloomLevel={bloomLevel}
          setBloomLevel={setBloomLevel}
          targetDepartments={targetDepartments}
          setTargetDepartments={setTargetDepartments}
          bulkCount={bulkCount}
          setBulkCount={setBulkCount}
          job={bulkJob}
          busy={busy}
          onStart={startBulk}
          onReset={() => setBulkJob(null)}
          onOpenReels={() => router.push("/admin/reels?status=draft")}
        />
      ) : (
      <div className="bg-white/5 border border-white/10 rounded p-6 space-y-4">
        {/* Source input */}
        {mode === "upload" && (
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-2">Source file</span>
            <input
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-vand-sand file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-vand-gold/15 file:text-vand-gold file:text-xs file:uppercase file:tracking-wider hover:file:bg-vand-gold/25 cursor-pointer"
            />
            {file && (
              <p className="text-[11px] text-vand-sand/50 mt-1">{file.name} ({Math.round(file.size / 1024)} KB)</p>
            )}
          </label>
        )}
        {mode === "url" && (
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-2">URL</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50"
            />
          </label>
        )}
        {mode === "text" && (
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-2">Source text</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder="Paste the content you want to convert into a reel…"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50 resize-y"
            />
            <p className="text-[10px] text-vand-sand/40 mt-1">{text.length.toLocaleString()} chars</p>
          </label>
        )}

        {/* Common: title */}
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-2">Title (optional)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Auto-generated if blank"
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50"
          />
        </label>

        {/* Audience */}
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-2">Audience</span>
          <DepartmentMultiSelect
            value={targetDepartments}
            onChange={setTargetDepartments}
          />
          <p className="text-[11px] text-vand-sand/40 mt-1.5">
            Select ALL STAFF to show this reel to everyone, or pick specific departments.
          </p>
        </label>

        {/* Topic + Bloom level */}
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-2">Topic</span>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-2">Skill level</span>
            <select
              value={bloomLevel}
              onChange={(e) => setBloomLevel(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50"
            >
              <option value="remember">Recall</option>
              <option value="understand">Comprehend</option>
              <option value="apply">Apply</option>
              <option value="analyze">Analyze</option>
              <option value="evaluate">Evaluate</option>
              <option value="create">Create</option>
            </select>
          </label>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-vand-sand/50">
            {busy && <span className="inline-flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> {status}</span>}
          </div>
          <button
            onClick={submit}
            disabled={busy}
            className="px-5 py-2.5 bg-vand-gold text-vand-black text-sm font-semibold rounded hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate reel"}
          </button>
        </div>
      </div>
      )}

      {mode !== "bulk" && result && (
        <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 rounded p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="text-vand-sand font-medium">Draft reel created</h3>
              <p className="text-xs text-vand-sand/60 mt-1">{result.title}</p>
              <p className="text-[11px] text-vand-sand/50 mt-1">
                Review and edit, then approve & publish to push it to learners.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <button
                  onClick={() => router.push(`/admin/reels/${result.reelId}`)}
                  className="px-3 py-1.5 text-xs bg-vand-gold text-vand-black rounded font-semibold hover:opacity-90"
                >
                  Review draft →
                </button>
                <a
                  href={`/api/admin/reels/${result.reelId}/source`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 text-xs text-vand-sand/70 hover:text-vand-gold"
                >
                  <FileText size={12} /> View source PDF
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  icon: Icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded border transition-all ${
        active
          ? "bg-vand-gold/10 border-vand-gold/40"
          : "bg-white/5 border-white/10 hover:bg-white/[0.07]"
      }`}
    >
      <Icon size={18} className={active ? "text-vand-gold" : "text-vand-sand/60"} />
      <div className={`text-sm font-condensed uppercase tracking-wider mt-2 ${active ? "text-vand-gold" : "text-vand-sand"}`}>
        {label}
      </div>
      <div className="text-[10px] text-vand-sand/50 mt-0.5">{sub}</div>
    </button>
  );
}

function BulkPanel({
  topics,
  topicId,
  setTopicId,
  bloomLevel,
  setBloomLevel,
  targetDepartments,
  setTargetDepartments,
  bulkCount,
  setBulkCount,
  job,
  busy,
  onStart,
  onReset,
  onOpenReels,
}: {
  topics: Topic[];
  topicId: string;
  setTopicId: (v: string) => void;
  bloomLevel: string;
  setBloomLevel: (v: string) => void;
  targetDepartments: string[];
  setTargetDepartments: (v: string[]) => void;
  bulkCount: number;
  setBulkCount: (v: number) => void;
  job: BulkJobState | null;
  busy: boolean;
  onStart: () => void;
  onReset: () => void;
  onOpenReels: () => void;
}) {
  const running =
    job &&
    (job.phase === "queued" ||
      job.phase === "discovering" ||
      job.phase === "deduping" ||
      job.phase === "generating");

  const doneCount = job ? job.items.filter((i) => i.status === "done").length : 0;
  const dupCount = job ? job.items.filter((i) => i.status === "duplicate").length : 0;
  const failCount = job ? job.items.filter((i) => i.status === "failed").length : 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded p-6 space-y-4">
      <div className="flex items-start gap-3 bg-vand-gold/5 border border-vand-gold/20 rounded p-3">
        <Globe size={16} className="text-vand-gold shrink-0 mt-0.5" />
        <p className="text-[12px] text-vand-sand/70 leading-relaxed">
          Pick a topic and audience. The platform searches the web for the most
          relevant recent articles from reputable publications (HBR, MIT Sloan,
          McKinsey, etc.), removes duplicates of reels you already have in this
          topic, and generates draft reels for you to review and publish.
        </p>
      </div>

      {/* Audience */}
      <label className="block">
        <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-2">
          Audience
        </span>
        <DepartmentMultiSelect
          value={targetDepartments}
          onChange={setTargetDepartments}
        />
        <p className="text-[11px] text-vand-sand/40 mt-1.5">
          Select ALL STAFF or pick the departments these reels are tailored for.
        </p>
      </label>

      {/* Topic / Skill / Count */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block sm:col-span-1">
          <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-2">
            Topic / domain
          </span>
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50"
          >
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-2">
            Skill level
          </span>
          <select
            value={bloomLevel}
            onChange={(e) => setBloomLevel(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50"
          >
            <option value="remember">Recall</option>
            <option value="understand">Comprehend</option>
            <option value="apply">Apply</option>
            <option value="analyze">Analyze</option>
            <option value="evaluate">Evaluate</option>
            <option value="create">Create</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-2">
            How many reels
          </span>
          <input
            type="number"
            min={1}
            max={15}
            value={bulkCount}
            onChange={(e) => setBulkCount(Math.max(1, Math.min(15, Number(e.target.value) || 1)))}
            disabled={!!running}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50 disabled:opacity-50"
          />
        </label>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-vand-sand/50">
          {running && (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> {job!.message}
            </span>
          )}
        </div>
        {!job || job.phase === "done" || job.phase === "failed" ? (
          <button
            onClick={onStart}
            disabled={busy}
            className="px-5 py-2.5 bg-vand-gold text-vand-black text-sm font-semibold rounded hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Starting…" : job ? "Run again" : "Discover & generate"}
          </button>
        ) : (
          <button
            disabled
            className="px-5 py-2.5 bg-vand-gold/40 text-vand-black text-sm font-semibold rounded cursor-not-allowed"
          >
            Working…
          </button>
        )}
      </div>

      {/* Job progress */}
      {job && (
        <div className="mt-3 bg-black/30 border border-white/10 rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-vand-sand/50 font-condensed">
                Bulk job · {job.topicLabel}
              </div>
              <div className="text-sm text-vand-sand mt-0.5">{job.message}</div>
            </div>
            {job.phase === "done" && (
              <button
                onClick={onOpenReels}
                className="px-3 py-1.5 text-xs bg-vand-gold text-vand-black rounded font-semibold hover:opacity-90"
              >
                Review drafts →
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-white/5 rounded overflow-hidden mb-3">
            <div
              className="h-full bg-vand-gold transition-all"
              style={{
                width: `${
                  job.phase === "done"
                    ? 100
                    : job.items.length === 0
                    ? job.phase === "discovering"
                      ? 15
                      : 5
                    : Math.min(
                        95,
                        Math.round(((doneCount + dupCount + failCount) / Math.max(1, job.count)) * 100)
                      )
                }%`,
              }}
            />
          </div>

          {/* Counters */}
          {job.items.length > 0 && (
            <div className="flex flex-wrap gap-3 text-[11px] text-vand-sand/60 mb-3">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={11} className="text-emerald-400" /> {doneCount} created
              </span>
              <span className="inline-flex items-center gap-1">
                <CopyIcon size={11} className="text-vand-sand/40" /> {dupCount} duplicates skipped
              </span>
              <span className="inline-flex items-center gap-1">
                <AlertTriangle size={11} className="text-amber-400" /> {failCount} failed
              </span>
            </div>
          )}

          {/* Per-item list */}
          {job.items.length > 0 && (
            <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {job.items.map((it, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 bg-white/5 border border-white/5 rounded px-2.5 py-2"
                >
                  <ItemBadge status={it.status} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-vand-sand truncate">{it.title}</div>
                    <div className="text-[10px] text-vand-sand/40 truncate">
                      {it.publication ? `${it.publication} · ` : ""}
                      {it.url}
                    </div>
                    {it.error && (
                      <div className="text-[10px] text-amber-300/80 mt-0.5">{it.error}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {(job.phase === "done" || job.phase === "failed") && (
            <div className="mt-4 flex items-center justify-end">
              <button
                onClick={onReset}
                className="text-[11px] text-vand-sand/50 hover:text-vand-sand"
              >
                Clear results
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemBadge({ status }: { status: BulkItemStatus }) {
  const map: Record<
    BulkItemStatus,
    { label: string; cls: string }
  > = {
    pending: { label: "Queued", cls: "bg-white/5 text-vand-sand/50 border-white/10" },
    scraping: { label: "Scraping", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
    generating: { label: "Writing", cls: "bg-vand-gold/15 text-vand-gold border-vand-gold/30" },
    done: { label: "Created", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    duplicate: { label: "Duplicate", cls: "bg-white/5 text-vand-sand/40 border-white/10" },
    failed: { label: "Failed", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-condensed shrink-0 mt-0.5 ${cls}`}
    >
      {label}
    </span>
  );
}
