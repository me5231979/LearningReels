"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Cpu,
  TrendingUp,
  Users,
  MessageCircle,
  Heart,
  Building,
  Settings,
  Rocket,
  Play,
  ChevronRight,
  Loader2,
  Search,
  X,
  Star,
} from "lucide-react";

const NEW_REEL_DAYS = 14;
function isNewReel(createdAt?: string): boolean {
  if (!createdAt) return false;
  const ms = Date.now() - new Date(createdAt).getTime();
  return ms < NEW_REEL_DAYS * 24 * 60 * 60 * 1000;
}
import { motion } from "framer-motion";
import CommModal from "@/components/comms/CommModal";

type TopicData = {
  id: string;
  slug: string;
  label: string;
  description: string;
  category: string;
  icon: string | null;
  reelCount: number;
  userLevel: string | null;
  userCompletions: number;
};

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  "leadership-management": {
    label: "Leadership & Management",
    icon: "crown",
    color: "from-amber-900/40 to-amber-800/20",
  },
  "ai-fluency": {
    label: "AI Fluency",
    icon: "cpu",
    color: "from-blue-900/40 to-blue-800/20",
  },
  "career-growth": {
    label: "Career & Growth",
    icon: "trending-up",
    color: "from-emerald-900/40 to-emerald-800/20",
  },
  "future-of-work": {
    label: "Future of Work",
    icon: "rocket",
    color: "from-purple-900/40 to-purple-800/20",
  },
  communication: {
    label: "Communication",
    icon: "message-circle",
    color: "from-cyan-900/40 to-cyan-800/20",
  },
  "wellbeing-resilience": {
    label: "Wellbeing & Resilience",
    icon: "heart",
    color: "from-rose-900/40 to-rose-800/20",
  },
  "vanderbilt-know-how": {
    label: "Vanderbilt Know-How",
    icon: "building",
    color: "from-vand-gold/20 to-amber-900/20",
  },
  "operations-productivity": {
    label: "Operations & Productivity",
    icon: "settings",
    color: "from-slate-700/40 to-slate-800/20",
  },
};

const ICON_MAP: Record<string, React.ElementType> = {
  crown: Crown,
  cpu: Cpu,
  "trending-up": TrendingUp,
  users: Users,
  "message-circle": MessageCircle,
  heart: Heart,
  building: Building,
  settings: Settings,
  rocket: Rocket,
};

function CategoryIcon({ name }: { name: string }) {
  const Icon = ICON_MAP[name] || Settings;
  return <Icon size={22} />;
}

type SearchHit = {
  id: string;
  title: string;
  summary: string;
  bloomLevel: string;
  estimatedSeconds: number;
  topicId: string;
  topicLabel: string;
  categorySlug: string;
  isFeatured?: boolean;
  createdAt?: string;
};

export default function HomeClient({ userName }: { userName: string }) {
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/topics")
      .then((r) => r.json())
      .then((d) => setTopics(d.topics || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Debounced reel search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/reels/search?q=${encodeURIComponent(q)}&limit=24`)
        .then((r) => r.json())
        .then((d) => setSearchResults(d.reels || []))
        .catch(console.error)
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Group topics by category
  const categories = Object.entries(CATEGORY_CONFIG).map(([key, config]) => ({
    key,
    ...config,
    topics: topics.filter((t) => t.category === key),
    totalReels: topics
      .filter((t) => t.category === key)
      .reduce((sum, t) => sum + t.reelCount, 0),
  }));

  // Filter visible categories based on query (match category label OR contained topic labels)
  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => {
      if (c.label.toLowerCase().includes(q)) return true;
      if (c.topics.some((t) => t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [categories, query]);

  const isSearching = query.trim().length >= 2;

  return (
    <div className="h-full overflow-y-auto bg-vand-black">
      <CommModal />
      {/* Header */}
      <div className="px-5 pt-6 pb-4 text-center">
        <img
          src="/vu-logo-horizontal.png"
          alt="Vanderbilt University"
          className="w-56 mx-auto mb-4"
        />
        <h1 className="font-serif text-2xl font-bold text-white mb-1">
          Welcome back, {userName.split(" ")[0]}
        </h1>
        <p className="text-vand-sand/50 text-sm px-2">
          Bite-sized learning reels to grow the skills that move your career forward
        </p>
      </div>

      {/* Search */}
      <div className="px-5 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-vand-sand/40" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics or reels…"
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-10 py-3 text-sm text-vand-sand placeholder:text-vand-sand/30 focus:outline-none focus:border-vand-gold/50"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-vand-sand/40 active:text-vand-sand hover:bg-white/10"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Quick play button */}
      {!isSearching && (
        <div className="px-5 mb-5">
          <Link
            href="/reels"
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-sm font-bold active:bg-vand-highlight transition-colors"
          >
            <Play size={18} fill="currentColor" />
            <span>Play All Reels</span>
            <ChevronRight size={16} className="ml-auto" />
          </Link>
        </div>
      )}

      {/* Topic grid / Search results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-vand-gold" />
        </div>
      ) : isSearching ? (
        <div className="px-5 pb-24 space-y-4">
          {filteredCategories.length > 0 && (
            <div>
              <h2 className="text-[11px] font-condensed uppercase tracking-widest text-vand-sand/40 mb-2">
                Matching topics
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {filteredCategories.map((cat) => (
                  <Link
                    key={cat.key}
                    href={`/topics/${cat.key}`}
                    className="block rounded-2xl border border-white/5 overflow-hidden active:scale-[0.98] transition-transform"
                  >
                    <div className={`bg-gradient-to-br ${cat.color} px-4 pt-3 pb-3`}>
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-vand-gold mb-2">
                        <CategoryIcon name={cat.icon} />
                      </div>
                      <h3 className="font-serif text-[14px] font-bold text-white leading-tight">
                        {cat.label}
                      </h3>
                      <p className="text-[10px] text-vand-sand/40 font-condensed uppercase tracking-wider mt-1">
                        {cat.totalReels} {cat.totalReels === 1 ? "reel" : "reels"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-condensed uppercase tracking-widest text-vand-sand/40">
                Matching reels
              </h2>
              {searching && <Loader2 size={12} className="animate-spin text-vand-gold/60" />}
            </div>
            {searchResults.length === 0 && !searching ? (
              <p className="text-vand-sand/40 text-xs py-6 text-center">
                No reels match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((reel) => (
                  <Link
                    key={reel.id}
                    href={`/topics/${reel.categorySlug}?play=1&reel=${reel.id}`}
                    className="block rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 active:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-serif text-[14px] font-bold text-white leading-snug flex-1 min-w-0 break-words">
                        {reel.title}
                      </h3>
                      <span className="text-[10px] text-vand-sand/30 shrink-0 mt-0.5">
                        {Math.ceil(reel.estimatedSeconds / 60)}m
                      </span>
                    </div>
                    <p className="text-vand-sand/40 text-xs leading-relaxed mt-1 line-clamp-2">
                      {reel.summary}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="inline-block text-[9px] font-condensed uppercase tracking-wider text-vand-gold/70 bg-vand-gold/10 border border-vand-gold/15 px-2 py-0.5 rounded-full leading-tight">
                        {reel.topicLabel}
                      </span>
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
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="px-5 pb-24 space-y-3">
          <h2 className="text-[11px] font-condensed uppercase tracking-widest text-vand-sand/40 mb-2">
            Professional Development
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat, i) => (
              <motion.div
                key={cat.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Link
                  href={`/topics/${cat.key}`}
                  className={`block rounded-2xl border border-white/5 overflow-hidden active:scale-[0.98] transition-transform`}
                >
                  <div
                    className={`bg-gradient-to-br ${cat.color} px-4 pt-4 pb-3`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-vand-gold mb-3">
                      <CategoryIcon name={cat.icon} />
                    </div>
                    <h3 className="font-serif text-[15px] font-bold text-white leading-tight mb-1">
                      {cat.label}
                    </h3>
                    <p className="text-[11px] text-vand-sand/40 font-condensed uppercase tracking-wider">
                      {cat.totalReels}{" "}
                      {cat.totalReels === 1 ? "reel" : "reels"}
                      {cat.topics.some((t) => t.userCompletions > 0) && (
                        <span className="text-vand-gold/60 ml-1">
                          {" "}
                          &middot; In progress
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
