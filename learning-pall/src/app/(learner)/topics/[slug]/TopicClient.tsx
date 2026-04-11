"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Play, Loader2, X, Search, Star } from "lucide-react";

const NEW_REEL_DAYS = 14;
function isNewReel(createdAt?: string): boolean {
  if (!createdAt) return false;
  const ms = Date.now() - new Date(createdAt).getTime();
  return ms < NEW_REEL_DAYS * 24 * 60 * 60 * 1000;
}
import { motion } from "framer-motion";
import ReelFeed, { type ReelData } from "@/components/reels/ReelFeed";

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

type ReelPreview = {
  id: string;
  title: string;
  summary: string;
  bloomLevel: string;
  topicLabel: string;
  coreCompetency: string | null;
  estimatedSeconds: number;
  completed: boolean;
};

export default function TopicClient({
  categorySlug,
  userId,
}: {
  categorySlug: string;
  userId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reels, setReels] = useState<ReelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const playMode = searchParams.get("play") === "1";
  const reelParam = searchParams.get("reel");
  const [startReelId, setStartReelId] = useState<string | null>(reelParam);

  const filteredReels = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reels;
    return reels.filter((r) => {
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.summary.toLowerCase().includes(q)) return true;
      if (r.topicLabel.toLowerCase().includes(q)) return true;
      if (r.coreCompetency && r.coreCompetency.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [reels, query]);

  // Sync startReelId with URL param so deep-links work
  useEffect(() => {
    setStartReelId(reelParam);
  }, [reelParam]);

  const enterPlay = (reelId: string | null) => {
    setStartReelId(reelId);
    const qs = reelId ? `?play=1&reel=${reelId}` : `?play=1`;
    router.replace(`/topics/${categorySlug}${qs}`);
  };

  const exitPlay = () => {
    router.replace(`/topics/${categorySlug}`);
  };

  // Use known category label, or fall back to the topic label from the first reel (for custom topics)
  const categoryLabel =
    CATEGORY_LABELS[categorySlug] ||
    reels[0]?.topicLabel ||
    "My Learning";

  useEffect(() => {
    fetch(`/api/reels/feed?category=${encodeURIComponent(categorySlug)}`)
      .then((r) => r.json())
      .then((d) => setReels(d.reels || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [categorySlug]);

  if (playMode) {
    if (loading || reels.length === 0) {
      return (
        <div className="h-full flex items-center justify-center bg-vand-black relative">
          <button
            onClick={exitPlay}
            aria-label="Exit play mode"
            className="absolute top-2 right-2 z-50 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/80 active:bg-black/70"
          >
            <X size={16} />
          </button>
          <Loader2 className="w-8 h-8 animate-spin text-vand-gold" />
        </div>
      );
    }
    return (
      <div className="h-full bg-vand-black relative">
        <button
          onClick={exitPlay}
          aria-label="Exit play mode"
          className="absolute top-2 right-2 z-50 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/80 active:bg-black/70"
        >
          <X size={16} />
        </button>
        <ReelFeed userId={userId} category={categorySlug} startReelId={startReelId} initialReels={reels} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-vand-black">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-vand-sand/50 text-sm mb-3 active:text-vand-sand/70"
        >
          <ArrowLeft size={16} />
          <span className="font-condensed uppercase tracking-wider text-[11px]">
            Home
          </span>
        </Link>
        <h1 className="font-serif text-xl font-bold text-white mb-1">
          {categoryLabel}
        </h1>
        <p className="text-vand-sand/50 text-sm">
          {query.trim()
            ? `${filteredReels.length} of ${reels.length} ${reels.length === 1 ? "reel" : "reels"}`
            : `${reels.length} ${reels.length === 1 ? "reel" : "reels"} available`}
        </p>
      </div>

      {/* Search */}
      {reels.length > 0 && (
        <div className="px-5 mb-3">
          <div className="relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-vand-sand/40" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this topic…"
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-9 py-2.5 text-sm text-vand-sand placeholder:text-vand-sand/30 focus:outline-none focus:border-vand-gold/50"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-vand-sand/40 active:text-vand-sand"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Play all button */}
      {reels.length > 0 && !query.trim() && (
        <div className="px-5 mb-4">
          <button
            onClick={() => enterPlay(null)}
            className="flex items-center gap-3 w-full px-5 py-3 rounded-2xl bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-sm font-bold active:bg-vand-highlight transition-colors"
          >
            <Play size={18} fill="currentColor" />
            <span>Play All</span>
          </button>
        </div>
      )}

      {/* Reel list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-vand-gold" />
        </div>
      ) : reels.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <p className="text-vand-sand/40 text-sm mb-4">
            No reels yet for this topic.
          </p>
          <Link
            href="/home"
            className="text-vand-gold text-sm font-condensed uppercase tracking-wider"
          >
            Browse other topics
          </Link>
        </div>
      ) : filteredReels.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-vand-sand/40 text-sm">
            No reels match &ldquo;{query}&rdquo;.
          </p>
        </div>
      ) : (
        <div className="px-5 pb-24 space-y-2">
          {filteredReels.map((reel, i) => (
            <motion.button
              key={reel.id}
              onClick={() => enterPlay(reel.id)}
              className="w-full text-left rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 active:bg-white/5 transition-colors"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif text-[15px] font-bold text-white leading-snug flex-1 min-w-0 break-words">
                    {reel.title}
                  </h3>
                  <span className="text-[10px] text-vand-sand/30 shrink-0 mt-0.5">
                    {Math.ceil(reel.estimatedSeconds / 60)}m
                  </span>
                </div>
                {(reel.isFeatured || isNewReel(reel.createdAt)) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {reel.isFeatured && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-condensed uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full leading-tight">
                        <Star size={9} fill="currentColor" /> Featured
                      </span>
                    )}
                    {isNewReel(reel.createdAt) && (
                      <span className="text-[9px] font-condensed uppercase tracking-wider text-vand-gold bg-vand-gold/15 border border-vand-gold/40 px-2 py-0.5 rounded-full leading-tight">
                        New
                      </span>
                    )}
                  </div>
                )}
                <p className="text-vand-sand/40 text-xs leading-relaxed">
                  {reel.summary}
                </p>
                {reel.coreCompetency && (
                  <span className="self-start text-[9px] font-condensed uppercase tracking-wider text-vand-gold/70 bg-vand-gold/10 border border-vand-gold/15 px-2 py-0.5 rounded-full leading-tight">
                    {reel.coreCompetency}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
