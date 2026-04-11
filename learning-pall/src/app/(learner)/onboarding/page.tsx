"use client";

import { useState } from "react";
import {
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Stage = "input" | "validating" | "rejected" | "grey-area" | "generating" | "ready";

type ValidateResult = {
  classification: "APPROVED" | "RESTRICTED" | "GREY_AREA";
  reason: string;
  refinedTopic?: string;
  topicDescription?: string;
};

export default function ExplorePage() {
  const [stage, setStage] = useState<Stage>("input");
  const [input, setInput] = useState("");
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [generatedTopic, setGeneratedTopic] = useState<{ slug: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!input.trim() || stage === "validating") return;
    setError(null);
    setStage("validating");

    try {
      const res = await fetch("/api/explore/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not validate topic.");
        setStage("input");
        return;
      }

      setValidateResult(data);

      if (data.classification === "RESTRICTED") {
        setStage("rejected");
        return;
      }

      if (data.classification === "GREY_AREA") {
        setStage("grey-area");
        return;
      }

      // APPROVED → start generation
      setStage("generating");
      const genRes = await fetch("/api/explore/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicLabel: data.refinedTopic || input.trim(),
          topicDescription: data.topicDescription || input.trim(),
        }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        setError(genData.error || "Could not generate reels.");
        setStage("input");
        return;
      }

      setGeneratedTopic({ slug: genData.slug, label: genData.label });
      setStage("ready");
    } catch {
      setError("Network error. Please try again.");
      setStage("input");
    }
  }

  function reset() {
    setStage("input");
    setInput("");
    setValidateResult(null);
    setGeneratedTopic(null);
    setError(null);
  }

  return (
    <div className="h-full overflow-y-auto bg-vand-black">
      <div className="max-w-md mx-auto px-6 py-8">
        {/* Logo + Header */}
        <div className="text-center mb-8">
          <img
            src="/vu-logo-white.png"
            alt="Vanderbilt University"
            className="w-24 mx-auto mb-4 opacity-80"
          />
          <h1 className="font-serif text-2xl font-bold text-white mb-2">
            Explore
          </h1>
          <p className="text-vand-sand/60 text-sm leading-relaxed">
            Tell us what practical skill you want to learn. We&apos;ll source
            reliable content and build a custom set of reels for you.
          </p>
        </div>

        {/* Where-to-find-it notice */}
        {(stage === "input" || stage === "ready") && (
          <Link
            href="/profile"
            className="mb-5 flex items-center gap-3 bg-vand-gold/10 border border-vand-gold/25 rounded-xl px-4 py-3 active:bg-vand-gold/15 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-vand-gold/20 border border-vand-gold/30 flex items-center justify-center shrink-0">
              <UserIcon size={14} className="text-vand-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-condensed uppercase tracking-wider text-vand-gold/80">
                Heads up
              </p>
              <p className="text-vand-sand/80 text-xs leading-snug">
                Topics you create live in your{" "}
                <span className="text-vand-gold font-bold">Profile</span> under{" "}
                <span className="text-vand-gold font-bold">My Learning</span>.
              </p>
            </div>
          </Link>
        )}

        <AnimatePresence mode="wait">
          {/* INPUT STAGE */}
          {stage === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
              >
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
                  <label className="text-[10px] font-condensed uppercase tracking-wider text-vand-sand/50 mb-2 block">
                    What do you want to learn?
                  </label>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g., How to give better executive presentations"
                    rows={3}
                    className="w-full bg-transparent text-white placeholder-white/30 text-sm focus:outline-none resize-none"
                  />
                </div>

                {error && (
                  <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-sm font-bold active:bg-vand-highlight transition-colors disabled:opacity-30"
                >
                  <Send size={14} />
                  Validate & Build Reels
                </button>

                <p className="text-vand-sand/30 text-[11px] text-center mt-4 leading-relaxed">
                  Practical professional learning only. We don&apos;t cover
                  health treatment, dangerous topics, alcohol/drugs, or deep
                  abstract theory.
                </p>
              </form>
            </motion.div>
          )}

          {/* VALIDATING STAGE */}
          {stage === "validating" && (
            <motion.div
              key="validating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <Loader2 className="w-8 h-8 animate-spin text-vand-gold mx-auto mb-4" />
              <p className="text-vand-sand/70 text-sm">
                Validating your topic...
              </p>
            </motion.div>
          )}

          {/* REJECTED STAGE */}
          {stage === "rejected" && validateResult && (
            <motion.div
              key="rejected"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="font-serif text-lg font-bold text-white mb-2">
                Not Authorized
              </h2>
              <p className="text-vand-sand/70 text-sm mb-6 leading-relaxed">
                {validateResult.reason}
              </p>
              <button
                onClick={reset}
                className="px-6 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-condensed uppercase tracking-wider text-sm font-bold active:bg-white/20 transition-colors"
              >
                Try Another Topic
              </button>
            </motion.div>
          )}

          {/* GREY AREA STAGE */}
          {stage === "grey-area" && validateResult && (
            <motion.div
              key="grey"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-yellow-400" />
              </div>
              <h2 className="font-serif text-lg font-bold text-white mb-2">
                Flagged for Review
              </h2>
              <p className="text-vand-sand/70 text-sm mb-2 leading-relaxed">
                {validateResult.reason}
              </p>
              <p className="text-vand-sand/40 text-xs mb-6">
                We&apos;ve sent this to an admin for review. Try a different
                angle or topic in the meantime.
              </p>
              <button
                onClick={reset}
                className="px-6 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-condensed uppercase tracking-wider text-sm font-bold active:bg-white/20 transition-colors"
              >
                Try Another Topic
              </button>
            </motion.div>
          )}

          {/* GENERATING STAGE */}
          {stage === "generating" && validateResult && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <motion.div
                className="w-20 h-20 rounded-2xl bg-vand-gold/15 border border-vand-gold/25 flex items-center justify-center mx-auto mb-5"
                animate={{ scale: [1, 1.05, 1], rotate: [0, 3, -3, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-9 h-9 text-vand-gold" />
              </motion.div>
              <h2 className="font-serif text-lg font-bold text-white mb-2">
                Building Your Reels
              </h2>
              <p className="text-vand-gold text-sm font-condensed uppercase tracking-wider mb-4">
                {validateResult.refinedTopic}
              </p>
              <p className="text-vand-sand/60 text-sm leading-relaxed mb-6">
                We&apos;re sourcing reliable content from trusted publications
                and building 3 starter reels just for you. You&apos;ll be able
                to dive deeper at the end of the feed if you want more.
              </p>
              <Loader2 className="w-6 h-6 animate-spin text-vand-gold mx-auto" />
            </motion.div>
          )}

          {/* READY STAGE */}
          {stage === "ready" && generatedTopic && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <motion.div
                className="w-20 h-20 rounded-2xl bg-vand-gold/15 border border-vand-gold/25 flex items-center justify-center mx-auto mb-5"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.6 }}
              >
                <CheckCircle className="w-10 h-10 text-vand-gold" />
              </motion.div>
              <h2 className="font-serif text-xl font-bold text-white mb-3">
                Your Reels Are Being Built
              </h2>
              <p className="text-vand-gold text-sm font-condensed uppercase tracking-wider mb-4">
                {generatedTopic.label}
              </p>
              <p className="text-vand-sand/70 text-sm leading-relaxed mb-6">
                We&apos;re generating 3 reels in the background. You&apos;ll
                find them under{" "}
                <span className="text-vand-gold font-bold">My Learning</span> in
                your <span className="text-vand-gold font-bold">Profile</span>{" "}
                in a moment. When you finish them, choose{" "}
                <span className="text-vand-gold font-bold">Dive Deeper</span> at
                the end of the feed if you want to explore further.
              </p>

              <Link
                href="/profile"
                className="block w-full px-6 py-3.5 rounded-xl bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-sm font-bold active:bg-vand-highlight transition-colors mb-3"
              >
                Go to My Learning
              </Link>
              <button
                onClick={reset}
                className="block w-full px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-vand-sand/70 font-condensed uppercase tracking-wider text-sm active:bg-white/10 transition-colors"
              >
                Explore Another Topic
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
