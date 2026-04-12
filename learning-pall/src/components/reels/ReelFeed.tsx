"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import ReelView from "./ReelView";
import { Loader2, RefreshCw, Sparkles, Heart } from "lucide-react";
import Link from "next/link";

export type ReelCardData = {
  id: string;
  order: number;
  cardType: "hook" | "narration" | "scenario" | "interaction" | "feedback";
  title: string;
  script: string;
  visualDescription: string;
  imageUrl: string | null;
  animationCue: string | null;
  quizJson: string | null;
  scenarioJson: string | null;
  durationMs: number;
};

export type ReelData = {
  id: string;
  title: string;
  summary: string;
  bloomLevel: string;
  estimatedSeconds: number;
  topicLabel: string;
  categoryLabel: string;
  sourceUrl: string | null;
  sourceCredit: string | null;
  coreCompetency: string | null;
  isFeatured?: boolean;
  createdAt?: string;
  hasArchivedSource?: boolean;
  cards: ReelCardData[];
};

export default function ReelFeed({ userId, category, startReelId, initialReels }: { userId: string; category?: string; startReelId?: string | null; initialReels?: ReelData[] }) {
  const [reels, setReels] = useState<ReelData[]>(initialReels || []);
  const [loading, setLoading] = useState(!initialReels);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [topicMeta, setTopicMeta] = useState<{ id: string; isCustom: boolean } | null>(null);
  const [deeperState, setDeeperState] = useState<"idle" | "loading" | "done" | "thanked">("idle");
  const containerRef = useRef<HTMLDivElement>(null);

  const loadReels = useCallback(async () => {
    setLoading(true);
    try {
      const url = category
        ? `/api/reels/feed?category=${encodeURIComponent(category)}`
        : "/api/reels/feed";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReels(data.reels || []);
        setTopicMeta(data.topic || null);
      }
    } catch (err) {
      console.error("Failed to load reels:", err);
    } finally {
      setLoading(false);
    }
  }, [category]);

  // Always fetch topic metadata even when initialReels is supplied
  useEffect(() => {
    if (initialReels && category && !topicMeta) {
      fetch(`/api/reels/feed?category=${encodeURIComponent(category)}`)
        .then((r) => r.json())
        .then((d) => setTopicMeta(d.topic || null))
        .catch(() => {});
    }
  }, [initialReels, category, topicMeta]);

  const handleGoDeeper = useCallback(async () => {
    if (!topicMeta) return;
    setDeeperState("loading");
    try {
      const res = await fetch("/api/explore/deeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: topicMeta.id }),
      });
      if (res.ok) {
        setDeeperState("done");
      } else {
        setDeeperState("idle");
      }
    } catch {
      setDeeperState("idle");
    }
  }, [topicMeta]);

  useEffect(() => {
    if (!initialReels) loadReels();
  }, [loadReels, initialReels]);

  // Reorder reels to start from the selected reel
  const orderedReels = (() => {
    if (!startReelId || reels.length === 0) return reels;
    const idx = reels.findIndex((r) => r.id === startReelId);
    if (idx <= 0) return reels;
    return [...reels.slice(idx), ...reels.slice(0, idx)];
  })();

  // Vertical scroll snap with IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container || reels.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-reel-index"));
            if (!isNaN(index)) setCurrentIndex(index);
          }
        }
      },
      { root: container, threshold: 0.6 }
    );

    const sections = container.querySelectorAll("[data-reel-index]");
    sections.forEach((s) => observer.observe(s));

    return () => observer.disconnect();
  }, [reels]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-vand-black">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-vand-gold mx-auto mb-3" />
          <p className="text-vand-sand/50 text-sm">Loading your reels...</p>
        </div>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-6 bg-vand-black">
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-vand-gold/10 border border-vand-gold/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎯</span>
          </div>
          <h2 className="font-serif text-xl font-bold text-white mb-2">
            No reels yet
          </h2>
          <p className="text-vand-sand/60 text-sm mb-6">
            We&apos;re generating your first learning reels based on your
            interests. Check back in a moment.
          </p>
          <button
            onClick={loadReels}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-sm font-bold hover:bg-vand-highlight transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="reel-container h-full overflow-y-scroll snap-y snap-mandatory"
    >
      {orderedReels.map((reel, index) => (
        <section
          key={reel.id}
          data-reel-index={index}
          className="snap-start h-full w-full"
        >
          <ReelView
            reel={reel}
            isActive={index === currentIndex}
            userId={userId}
          />
        </section>
      ))}

      {/* End-of-feed indicator */}
      {reels.length > 0 && (
        <section className="snap-start h-full w-full flex items-center justify-center bg-vand-black">
          <div className="text-center px-8 max-w-sm">
            {topicMeta?.isCustom && deeperState === "idle" ? (
              <>
                <div className="w-20 h-20 rounded-2xl bg-vand-gold/15 border border-vand-gold/25 flex items-center justify-center mx-auto mb-5">
                  <Sparkles className="w-9 h-9 text-vand-gold" />
                </div>
                <h2 className="font-serif text-xl font-bold text-white mb-2">
                  Dive Deeper?
                </h2>
                <p className="text-vand-sand/60 text-sm mb-6 leading-relaxed">
                  You&apos;ve finished your starter reels. If you want to keep
                  going, we&apos;ll source 5 more advanced reels with expert
                  frameworks and edge cases.
                </p>
                <button
                  onClick={handleGoDeeper}
                  className="block w-full px-6 py-3.5 rounded-xl bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-sm font-bold active:bg-vand-highlight transition-colors mb-2"
                >
                  Yes, Dive Deeper
                </button>
                <button
                  onClick={() => setDeeperState("thanked")}
                  className="block w-full px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-vand-sand/70 font-condensed uppercase tracking-wider text-sm active:bg-white/10 transition-colors"
                >
                  No Thanks, I&apos;m Done
                </button>
              </>
            ) : topicMeta?.isCustom && deeperState === "loading" ? (
              <>
                <Loader2 className="w-10 h-10 animate-spin text-vand-gold mx-auto mb-4" />
                <h2 className="font-serif text-xl font-bold text-white mb-2">
                  Sourcing deeper content...
                </h2>
                <p className="text-vand-sand/60 text-sm">
                  We&apos;re building 5 advanced reels just for you.
                </p>
              </>
            ) : topicMeta?.isCustom && deeperState === "done" ? (
              <>
                <div className="w-20 h-20 rounded-2xl bg-vand-gold/15 border border-vand-gold/25 flex items-center justify-center mx-auto mb-5">
                  <Sparkles className="w-9 h-9 text-vand-gold" />
                </div>
                <h2 className="font-serif text-xl font-bold text-white mb-2">
                  On the way!
                </h2>
                <p className="text-vand-sand/60 text-sm mb-6 leading-relaxed">
                  Your advanced reels are being generated. Refresh in a moment
                  to see them.
                </p>
                <button
                  onClick={loadReels}
                  className="px-6 py-2.5 rounded-xl bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-sm font-bold active:bg-vand-highlight transition-colors"
                >
                  Refresh
                </button>
              </>
            ) : topicMeta?.isCustom && deeperState === "thanked" ? (
              <>
                <div className="w-20 h-20 rounded-2xl bg-vand-gold/15 border border-vand-gold/25 flex items-center justify-center mx-auto mb-5">
                  <Heart className="w-9 h-9 text-vand-gold" fill="currentColor" />
                </div>
                <h2 className="font-serif text-xl font-bold text-white mb-2">
                  Thank you for learning!
                </h2>
                <p className="text-vand-sand/60 text-sm mb-6 leading-relaxed">
                  Great work completing this topic. Keep building your skills.
                </p>
                <Link
                  href="/onboarding"
                  className="block w-full px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-vand-sand/70 font-condensed uppercase tracking-wider text-sm active:bg-white/10 transition-colors"
                >
                  Explore a New Topic
                </Link>
              </>
            ) : (
              <>
                <img
                  src="/vu-logo-white.png"
                  alt="Vanderbilt University"
                  className="w-28 mx-auto mb-6 opacity-40"
                />
                <h2 className="font-serif text-xl font-bold text-white mb-2">
                  You&apos;re all caught up!
                </h2>
                <p className="text-vand-sand/50 text-sm mb-6">
                  Check back later for new reels and review sessions.
                </p>
                <button
                  onClick={() => {
                    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-vand-sand/70 font-condensed uppercase tracking-wider text-sm hover:bg-white/10 transition-colors"
                >
                  Back to top
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
