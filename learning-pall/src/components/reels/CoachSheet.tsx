"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, MessageCircle, Sparkles } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; ts: number };

type LoadState =
  | { status: "loading" }
  | {
      status: "ready";
      openingQuestion: string;
      messages: Message[];
      turnsUsed: number;
      turnsRemaining: number;
      maxTurns: number;
    }
  | { status: "error"; error: string };

export default function CoachSheet({
  reelId,
  reelTitle,
  onClose,
}: {
  reelId: string;
  reelTitle: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load prior conversation (if any) + opening question
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reels/${reelId}/coach`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to load coach");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setState({
          status: "ready",
          openingQuestion: data.openingQuestion,
          messages: data.messages || [],
          turnsUsed: data.turnsUsed || 0,
          turnsRemaining:
            typeof data.turnsRemaining === "number"
              ? data.turnsRemaining
              : data.maxTurns || 10,
          maxTurns: data.maxTurns || 10,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ status: "error", error: e.message || "Load failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [reelId]);

  // Autoscroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [state]);

  const send = useCallback(async () => {
    if (state.status !== "ready") return;
    const text = input.trim();
    if (!text || sending || state.turnsRemaining <= 0) return;

    const userMsg: Message = { role: "user", content: text, ts: Date.now() };
    const optimistic = [...state.messages, userMsg];
    setState({ ...state, messages: optimistic });
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`/api/reels/${reelId}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({
          ...state,
          messages: optimistic,
          turnsUsed:
            typeof data.turnsUsed === "number" ? data.turnsUsed : state.turnsUsed,
          turnsRemaining:
            typeof data.turnsRemaining === "number"
              ? data.turnsRemaining
              : state.turnsRemaining,
        });
        // Surface error as an inline assistant-style bubble
        const errMsg: Message = {
          role: "assistant",
          content:
            data.message ||
            data.error ||
            "Something went wrong. Give it another try.",
          ts: Date.now(),
        };
        setState((s) =>
          s.status === "ready" ? { ...s, messages: [...optimistic, errMsg] } : s
        );
        return;
      }
      setState({
        ...state,
        messages: data.messages,
        turnsUsed: data.turnsUsed,
        turnsRemaining: data.turnsRemaining,
      });
    } catch {
      const errMsg: Message = {
        role: "assistant",
        content: "Network error. Please try again.",
        ts: Date.now(),
      };
      setState((s) =>
        s.status === "ready" ? { ...s, messages: [...optimistic, errMsg] } : s
      );
    } finally {
      setSending(false);
    }
  }, [input, reelId, sending, state]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[120] bg-black/70 flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md bg-vand-black border-t border-white/10 rounded-t-3xl flex flex-col"
          style={{ height: "80vh", maxHeight: "80vh" }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-white/5">
            <div className="w-9 h-9 rounded-xl bg-vand-gold/15 border border-vand-gold/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-vand-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-condensed uppercase tracking-wider text-vand-gold/80">
                Reel Coach
              </p>
              <p className="font-serif text-sm text-white truncate">
                {reelTitle}
              </p>
            </div>
            {state.status === "ready" && (
              <span className="text-[10px] font-condensed uppercase tracking-wider text-vand-sand/40 shrink-0">
                {state.turnsRemaining}/{state.maxTurns} left
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="Close coach"
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-vand-sand/60 active:bg-white/10 shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
          >
            {state.status === "loading" && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-vand-gold" />
              </div>
            )}

            {state.status === "error" && (
              <div className="text-center text-vand-sand/60 text-sm py-10">
                <MessageCircle className="w-8 h-8 text-vand-sand/30 mx-auto mb-3" />
                <p className="mb-1">Couldn&apos;t load the coach.</p>
                <p className="text-xs text-vand-sand/40">{state.error}</p>
              </div>
            )}

            {state.status === "ready" && (
              <>
                {/* Opening question from the persona */}
                <CoachBubble content={state.openingQuestion} />
                {state.messages.map((m, i) =>
                  m.role === "assistant" ? (
                    <CoachBubble key={i} content={m.content} />
                  ) : (
                    <LearnerBubble key={i} content={m.content} />
                  )
                )}
                {sending && (
                  <div className="flex items-center gap-2 text-vand-sand/40 text-xs pl-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Coach is thinking…
                  </div>
                )}
                {state.turnsRemaining === 0 && !sending && (
                  <div className="text-center text-vand-sand/50 text-xs py-4 border-t border-white/5 mt-4">
                    You&apos;ve reached the coaching limit for this reel. Take
                    what you have and go apply it.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input */}
          {state.status === "ready" && state.turnsRemaining > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="px-4 py-3 border-t border-white/5 flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask the coach…"
                rows={1}
                disabled={sending}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-vand-sand/30 focus:outline-none focus:border-vand-gold/50 resize-none max-h-24"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="w-10 h-10 rounded-xl bg-vand-gold text-vand-black flex items-center justify-center disabled:opacity-30 active:bg-vand-highlight transition-colors shrink-0"
                aria-label="Send message"
              >
                {sending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function CoachBubble({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-lg bg-vand-gold/15 border border-vand-gold/30 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3 h-3 text-vand-gold" />
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-vand-sand/90 leading-relaxed max-w-[85%] whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

function LearnerBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-vand-gold/20 border border-vand-gold/30 rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm text-white leading-relaxed max-w-[85%] whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}
