"use client";

import { useState, useCallback, useEffect } from "react";
import type { ReelData, ReelCardData } from "./ReelFeed";
import HookCard from "./cards/HookCard";
import NarrationCard from "./cards/NarrationCard";
import InteractionCard from "./cards/InteractionCard";
import FeedbackCard from "./cards/FeedbackCard";
import {
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Home,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Heart,
  Flag,
  FileText,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import CoachSheet from "./CoachSheet";

const CATEGORY_LABELS: Record<string, string> = {
  "leadership-management": "Leadership & Management",
  "ai-fluency": "AI Fluency",
  "career-growth": "Career & Growth",
  "future-of-work": "Future of Work",
  communication: "Communication",
  "wellbeing-resilience": "Wellbeing & Resilience",
  "vanderbilt-know-how": "Vanderbilt Know-How",
  "operations-productivity": "Operations & Productivity",
};

type Props = {
  reel: ReelData;
  isActive: boolean;
  userId: string;
};

export default function ReelView({ reel, isActive }: Props) {
  const [cardIndex, setCardIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);

  // Reactions state
  const [thumbs, setThumbs] = useState<"up" | "down" | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

  // Load existing reaction on mount
  useEffect(() => {
    fetch(`/api/reels/${reel.id}/react`)
      .then((r) => r.json())
      .then((d) => {
        if (d.reaction) {
          setThumbs(d.reaction.thumbs || null);
          setFavorited(d.reaction.favorited || false);
        }
      })
      .catch(() => {});
  }, [reel.id]);

  const sendReaction = useCallback(
    (update: { thumbs?: "up" | "down" | null; favorited?: boolean }) => {
      fetch(`/api/reels/${reel.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      }).catch(console.error);
    },
    [reel.id]
  );

  const handleThumb = useCallback(
    (value: "up" | "down") => {
      const newValue = thumbs === value ? null : value;
      setThumbs(newValue);
      sendReaction({ thumbs: newValue });
    },
    [thumbs, sendReaction]
  );

  const handleFavorite = useCallback(() => {
    const newValue = !favorited;
    setFavorited(newValue);
    sendReaction({ favorited: newValue });
  }, [favorited, sendReaction]);

  const submitReport = useCallback(
    async (reason: string, details?: string) => {
      try {
        const res = await fetch(`/api/reels/${reel.id}/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, details }),
        });
        if (res.ok) {
          setReportSent(true);
          setTimeout(() => setReportOpen(false), 1200);
        }
      } catch {}
    },
    [reel.id]
  );

  const currentCard = reel.cards[cardIndex];
  const isLastCard = cardIndex === reel.cards.length - 1;
  const isFirstCard = cardIndex === 0;

  const nextCard = useCallback(() => {
    if (isLastCard) {
      setCompleted(true);
      fetch(`/api/reels/${reel.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }).catch(console.error);
    } else {
      setCardIndex((i) => i + 1);
    }
  }, [isLastCard, reel.id, answers]);

  const prevCard = useCallback(() => {
    setCardIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleAnswer = useCallback(
    (cardId: string, answer: string) => {
      setAnswers((prev) => ({ ...prev, [cardId]: answer }));
    },
    []
  );

  if (!currentCard) return null;

  function renderCard(card: ReelCardData) {
    const props = {
      card,
      isActive,
      onNext: nextCard,
      onPrev: prevCard,
    };

    switch (card.cardType) {
      case "hook":
        return <HookCard {...props} reelTitle={reel.title} />;
      case "narration":
        return <NarrationCard {...props} />;
      case "interaction":
        return (
          <InteractionCard
            {...props}
            onAnswer={(answer) => handleAnswer(card.id, answer)}
          />
        );
      case "feedback":
        return <FeedbackCard {...props} />;
      default:
        return <NarrationCard {...props} />;
    }
  }

  if (completed) {
    return (
      <div className="h-full relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-vand-gold/10 via-vand-black to-vand-black" />
        <div className="relative h-full flex items-center justify-center px-6 z-10">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "backOut" }}
          >
            <motion.div
              className="w-20 h-20 rounded-2xl bg-vand-gold/20 border border-vand-gold/30 flex items-center justify-center mx-auto mb-5"
              animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-4xl">✨</span>
            </motion.div>
            <h2 className="font-serif text-2xl font-bold text-white mb-2">
              Reel Complete!
            </h2>
            <p className="text-vand-sand/60 text-sm mb-3">{reel.title}</p>

            {/* Reactions row */}
            <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
              <button
                onClick={() => handleThumb("up")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-condensed uppercase tracking-wider transition-all ${
                  thumbs === "up"
                    ? "bg-vand-gold/20 text-vand-gold border border-vand-gold/30"
                    : "bg-white/5 text-vand-sand/40 border border-white/10 active:bg-white/10"
                }`}
              >
                <ThumbsUp size={14} fill={thumbs === "up" ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => handleThumb("down")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-condensed uppercase tracking-wider transition-all ${
                  thumbs === "down"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-white/5 text-vand-sand/40 border border-white/10 active:bg-white/10"
                }`}
              >
                <ThumbsDown size={14} fill={thumbs === "down" ? "currentColor" : "none"} />
              </button>
              <button
                onClick={handleFavorite}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-condensed uppercase tracking-wider transition-all ${
                  favorited
                    ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                    : "bg-white/5 text-vand-sand/40 border border-white/10 active:bg-white/10"
                }`}
              >
                <Heart size={14} fill={favorited ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => setReportOpen(true)}
                title="Report this content"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-condensed uppercase tracking-wider transition-all bg-white/5 text-vand-sand/40 border border-white/10 active:bg-white/10"
              >
                <Flag size={14} />
              </button>
            </div>

            {reel.hasArchivedSource && (
              <a
                href={`/api/reels/${reel.id}/source`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  // Force a real new browser window even when running as a
                  // standalone PWA, where target="_blank" otherwise navigates
                  // in-place inside the webview.
                  e.preventDefault();
                  window.open(
                    `/api/reels/${reel.id}/source`,
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
                className="inline-flex items-center gap-1.5 text-vand-gold/70 text-xs hover:text-vand-gold transition-colors mb-3"
              >
                <FileText size={12} />
                View source PDF
              </a>
            )}

            <div className="flex flex-col items-center gap-2 mb-4">
              <button
                onClick={() => setCoachOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-sm font-bold active:bg-vand-highlight transition-colors"
              >
                <MessageCircle size={14} />
                Talk to Coach
              </button>
              <button
                onClick={() => {
                  setCardIndex(0);
                  setAnswers({});
                  setCompleted(false);
                }}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-vand-sand/70 font-condensed uppercase tracking-wider text-xs font-bold active:bg-white/10 transition-colors"
              >
                <RotateCcw size={12} />
                Retake
              </button>
            </div>

            {/* Core competency badge */}
            {reel.coreCompetency && (
              <div className="mb-3">
                <span className="inline-block text-[10px] font-condensed uppercase tracking-wider text-vand-gold/80 bg-vand-gold/10 border border-vand-gold/20 px-3 py-1 rounded-full">
                  {reel.coreCompetency}
                </span>
              </div>
            )}

            {/* Source credit + Learn more */}
            <div className="mb-4">
              {reel.sourceCredit && (
                <p className="text-vand-sand/40 text-[11px] mb-1.5">
                  Content sourced from {reel.sourceCredit}
                </p>
              )}
              {reel.sourceUrl && (
                <a
                  href={reel.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    // Force a real new browser window from PWA standalone mode.
                    e.preventDefault();
                    window.open(
                      reel.sourceUrl!,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                  className="inline-flex items-center gap-1.5 text-vand-gold/60 text-xs hover:text-vand-gold transition-colors"
                >
                  <ExternalLink size={12} />
                  Learn more
                </a>
              )}
            </div>

            <p className="text-vand-sand/40 text-xs mb-4">
              swipe up for the next reel
            </p>
            <ChevronUp className="w-5 h-5 text-vand-gold/50 mx-auto animate-bounce" />
          </motion.div>
        </div>

        {reportOpen && (
          <ReportModal
            sent={reportSent}
            onClose={() => {
              setReportOpen(false);
              setReportSent(false);
            }}
            onSubmit={submitReport}
          />
        )}

        {coachOpen && (
          <CoachSheet
            reelId={reel.id}
            reelTitle={reel.title}
            onClose={() => setCoachOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="w-full bg-vand-black"
      style={{ height: "100%", display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr) auto" }}
    >
      {/* Row 1: Progress bar */}
      <div className="flex gap-1 px-3 pt-2 pb-1 z-30">
        {reel.cards.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/15"
          >
            <motion.div
              className="h-full bg-vand-gold rounded-full"
              initial={{ width: "0%" }}
              animate={{
                width:
                  i < cardIndex
                    ? "100%"
                    : i === cardIndex
                    ? "50%"
                    : "0%",
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
        ))}
      </div>

      {/* Row 2: Home + Domain / Topic / Skill — stacked on mobile, inline on larger screens */}
      <div className="px-4 py-1 z-20">
        <div className="flex items-start gap-2">
          <Link
            href="/home"
            className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-vand-sand/50 active:bg-white/10 shrink-0 mt-0.5"
          >
            <Home size={12} />
          </Link>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {/* Domain | Topic — wraps if needed, never truncated */}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="text-[10px] font-condensed uppercase tracking-wider text-vand-sand/70 font-bold">
                {CATEGORY_LABELS[reel.categoryLabel] || reel.categoryLabel}
              </span>
              <span className="text-[10px] text-vand-sand/30">|</span>
              <span className="text-[10px] font-condensed uppercase tracking-wider text-vand-sand/50">
                {reel.topicLabel}
              </span>
            </div>
            {/* Core competency / skill badge on its own line */}
            {reel.coreCompetency && (
              <span className="self-start text-[9px] font-condensed uppercase tracking-wider text-vand-gold/80 bg-vand-gold/10 border border-vand-gold/20 px-2 py-0.5 rounded-full leading-tight">
                {reel.coreCompetency}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Card content — takes remaining space, overflow hidden */}
      <div className="overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={cardIndex}
            className="h-full w-full"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            {renderCard(currentCard)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Row 4: Bottom navigation bar — always visible */}
      <div className="z-40 px-4 py-2 bg-vand-black border-t border-white/5">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={prevCard}
            disabled={isFirstCard}
            className={`flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-condensed uppercase tracking-wider font-bold transition-all ${
              isFirstCard
                ? "text-vand-sand/20 cursor-not-allowed"
                : "text-white bg-white/10 border border-white/30 active:bg-white/20"
            }`}
          >
            <ChevronLeft size={14} />
            Back
          </button>

          <div className="flex gap-1.5">
            {reel.cards.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i === cardIndex
                    ? "bg-vand-gold w-4"
                    : i < cardIndex
                    ? "bg-vand-gold/40"
                    : "bg-white/15"
                }`}
              />
            ))}
          </div>

          {currentCard.cardType !== "interaction" || answers[currentCard.id] ? (
            <button
              onClick={nextCard}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-condensed uppercase tracking-wider bg-vand-gold text-vand-black font-bold active:bg-vand-highlight transition-all"
            >
              {isLastCard ? "Done" : "Next"}
              <ChevronRight size={14} />
            </button>
          ) : (
            <div className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-condensed uppercase tracking-wider text-vand-sand/20">
              Answer first
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "policy", label: "Against policy / harmful" },
  { value: "inaccurate", label: "Inaccurate or misleading" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "off_topic", label: "Off-topic" },
  { value: "other", label: "Other" },
];

function ReportModal({
  sent,
  onClose,
  onSubmit,
}: {
  sent: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-vand-black border border-white/10 rounded-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
              <Flag className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-vand-sand text-sm">Report sent. Thank you.</p>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-condensed uppercase tracking-wider text-vand-sand mb-1">
              Report content
            </h3>
            <p className="text-xs text-vand-sand/50 mb-4">
              Let the team know what&apos;s wrong with this reel. Reports go to the super admin.
            </p>
            <div className="space-y-2 mb-4">
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm text-vand-sand/80 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-vand-gold"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Optional details (max 500 chars)"
              maxLength={500}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand placeholder:text-vand-sand/30 focus:outline-none focus:border-vand-gold/50 resize-y mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-xs text-vand-sand/60 hover:text-vand-sand">
                Cancel
              </button>
              <button
                onClick={() => reason && onSubmit(reason, details || undefined)}
                disabled={!reason}
                className="px-3 py-1.5 text-xs bg-vand-gold text-vand-black rounded font-semibold disabled:opacity-30"
              >
                Send report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
