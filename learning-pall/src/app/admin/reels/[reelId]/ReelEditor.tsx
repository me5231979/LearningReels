"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, FileText, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

type Quiz = {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation?: string;
} | null;

type Card = {
  id: string;
  order: number;
  cardType: string;
  title: string;
  script: string;
  quizJson: string | null;
};

type Reel = {
  id: string;
  title: string;
  summary: string;
  bloomLevel: string;
  status: string;
  sourceCredit: string | null;
  sourceUrl: string | null;
  topicLabel: string;
  topicSlug: string;
  completions: number;
  reportCount: number;
  hasArchivedSource: boolean;
  cards: Card[];
};

export default function ReelEditor({ reel }: { reel: Reel }) {
  const router = useRouter();
  const [title, setTitle] = useState(reel.title);
  const [summary, setSummary] = useState(reel.summary);
  const [status, setStatus] = useState(reel.status);
  const [sourceCredit, setSourceCredit] = useState(reel.sourceCredit || "");
  const [cards, setCards] = useState<Card[]>(reel.cards);
  const [busy, setBusy] = useState(false);

  function updateCard(id: string, patch: Partial<Card>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function parseQuiz(c: Card): Quiz {
    if (!c.quizJson) return null;
    try {
      return JSON.parse(c.quizJson);
    } catch {
      return null;
    }
  }

  function updateQuiz(c: Card, patch: Partial<NonNullable<Quiz>>) {
    const cur = parseQuiz(c) || { question: "", choices: ["", "", "", ""], correctIndex: 0, explanation: "" };
    const next = { ...cur, ...patch };
    updateCard(c.id, { quizJson: JSON.stringify(next) });
  }

  async function save(opts?: { publish?: boolean }) {
    setBusy(true);
    try {
      const nextStatus = opts?.publish ? "published" : status;
      const res = await fetch(`/api/admin/reels/${reel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary,
          status: nextStatus,
          sourceCredit,
          cards: cards.map((c) => ({
            id: c.id,
            title: c.title,
            script: c.script,
            quizJson: c.quizJson,
          })),
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Save failed");
        return;
      }
      if (opts?.publish) {
        setStatus("published");
        alert("Reel approved and published. Learners can now see it.");
      } else {
        alert("Saved");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm("Permanently delete this reel? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/reels/${reel.id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/reels");
    else alert("Delete failed");
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <Link href="/admin/reels" className="inline-flex items-center gap-2 text-xs text-vand-sand/50 hover:text-vand-sand mb-4">
        <ArrowLeft size={12} /> Reels Library
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-condensed uppercase tracking-wider text-vand-sand">Edit Reel</h1>
          <p className="text-xs text-vand-sand/50 mt-1">
            {reel.topicLabel} · {skillLabel(reel.bloomLevel)} · {reel.completions} completions · {reel.reportCount} reports
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {reel.hasArchivedSource && (
            <a
              href={`/api/admin/reels/${reel.id}/source`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 px-3 py-2 text-xs text-vand-sand/70 border border-white/10 rounded hover:bg-white/5"
            >
              <FileText size={12} /> View source PDF <ExternalLink size={10} />
            </a>
          )}
          <button onClick={del} className="inline-flex items-center gap-2 px-3 py-2 text-xs text-red-400 border border-red-500/30 rounded hover:bg-red-500/10">
            <Trash2 size={12} /> Delete
          </button>
          <button
            onClick={() => save()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-white/10 text-vand-sand rounded font-semibold hover:bg-white/15 disabled:opacity-50"
          >
            <Save size={14} /> {busy ? "Saving…" : "Save"}
          </button>
          {status !== "published" && (
            <button
              onClick={() => save({ publish: true })}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-vand-gold text-vand-black rounded font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 size={14} /> Approve & publish
            </button>
          )}
        </div>
      </div>

      {status === "draft" && (
        <div className="mb-6 bg-vand-gold/10 border border-vand-gold/40 rounded p-4 flex items-start gap-3">
          <AlertCircle className="text-vand-gold shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-vand-sand/90">
            <strong className="text-vand-gold">Draft</strong> — this reel is not yet visible to learners.
            Review the title, summary, narration scripts, and quiz, then click <strong>Approve &amp; publish</strong> to push it to circulation.
          </div>
        </div>
      )}

      <section className="bg-white/5 border border-white/10 rounded p-5 mb-6">
        <h2 className="text-xs font-condensed uppercase tracking-wider text-vand-sand/60 mb-4">Reel</h2>
        <div className="space-y-4">
          <Field label="Title" value={title} onChange={setTitle} />
          <Field label="Summary" value={summary} onChange={setSummary} multiline />
          <Field label="Source credit" value={sourceCredit} onChange={setSourceCredit} />
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-1">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-condensed uppercase tracking-wider text-vand-sand/60 mb-4">Cards</h2>
        <div className="space-y-4">
          {cards.map((c) => {
            const quiz = parseQuiz(c);
            return (
              <div key={c.id} className="bg-white/5 border border-white/10 rounded p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-vand-gold font-condensed">
                    Card {c.order + 1} · {c.cardType}
                  </div>
                </div>
                <div className="space-y-3">
                  <Field label="Title" value={c.title} onChange={(v) => updateCard(c.id, { title: v })} />
                  <Field label="Script" value={c.script} onChange={(v) => updateCard(c.id, { script: v })} multiline />
                  {quiz && (
                    <div className="border-t border-white/10 pt-3 mt-3">
                      <div className="text-[10px] uppercase tracking-wider text-vand-sand/50 mb-2">Quiz</div>
                      <Field label="Question" value={quiz.question} onChange={(v) => updateQuiz(c, { question: v })} />
                      {quiz.choices.map((choice, i) => (
                        <div key={i} className="flex items-center gap-2 mt-2">
                          <input
                            type="radio"
                            name={`correct-${c.id}`}
                            checked={quiz.correctIndex === i}
                            onChange={() => updateQuiz(c, { correctIndex: i })}
                          />
                          <input
                            value={choice}
                            onChange={(e) => {
                              const next = [...quiz.choices];
                              next[i] = e.target.value;
                              updateQuiz(c, { choices: next });
                            }}
                            className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50"
                          />
                        </div>
                      ))}
                      <div className="mt-3">
                        <Field
                          label="Explanation"
                          value={quiz.explanation || ""}
                          onChange={(v) => updateQuiz(c, { explanation: v })}
                          multiline
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

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

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-1">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50 resize-y"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50"
        />
      )}
    </label>
  );
}
