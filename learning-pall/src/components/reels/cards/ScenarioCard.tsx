"use client";

import { useState, useRef, useEffect } from "react";
import type { ReelCardData } from "../ReelFeed";
import { motion, AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";

type ScenarioChoice = {
  label: string;
  feedback: string;
};

type ScenarioData = {
  situation: string;
  choices: ScenarioChoice[];
  debrief: string;
};

type Props = {
  card: ReelCardData;
  isActive: boolean;
  onNext: () => void;
  onPrev: () => void;
  onAnswer: (answer: string) => void;
};

export default function ScenarioCard({
  card,
  isActive,
  onAnswer,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showDebrief, setShowDebrief] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scenario: ScenarioData | null = card.scenarioJson
    ? JSON.parse(card.scenarioJson)
    : null;

  // Auto-scroll to feedback when choice is selected
  useEffect(() => {
    if (selected !== null && feedbackRef.current) {
      setTimeout(() => {
        feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
    }
  }, [selected]);

  // Show debrief after reading feedback
  useEffect(() => {
    if (selected !== null && !showDebrief) {
      const timer = setTimeout(() => setShowDebrief(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [selected, showDebrief]);

  if (!scenario) {
    // Fallback: render as plain text if no scenarioJson
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/15 via-vand-black to-vand-black" />
        <div className="relative h-full flex flex-col items-center justify-center px-8 z-10">
          <motion.div
            className="text-center max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={isActive ? { opacity: 1, y: 0 } : {}}
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
              <Users size={24} className="text-amber-400" />
            </div>
            <p className="font-condensed text-xs uppercase tracking-wider text-vand-gold mb-4">
              What Would You Do?
            </p>
            <h3 className="font-serif text-xl font-bold text-white mb-4">
              {card.script}
            </h3>
          </motion.div>
        </div>
      </div>
    );
  }

  function handleSelect(index: number) {
    if (selected !== null) return; // Already chose
    setSelected(index);
    onAnswer(String(index));
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-900/15 via-vand-black to-vand-black" />

      <div
        ref={scrollContainerRef}
        className="relative h-full overflow-y-auto px-5 py-4 z-10"
      >
        <motion.div
          className="max-w-sm mx-auto w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={isActive ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
        >
          {/* Badge */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
              <Users size={14} className="text-amber-400" />
            </div>
            <p className="font-condensed text-xs uppercase tracking-wider text-amber-400">
              What Would You Do?
            </p>
          </div>

          {/* Situation */}
          <p className="text-vand-sand/90 text-[13px] leading-relaxed mb-4">
            {scenario.situation}
          </p>

          {/* Choices */}
          <div className="space-y-2">
            {scenario.choices.map((choice, i) => {
              let borderColor = "border-white/10";
              let bgColor = "bg-white/5";

              if (selected !== null) {
                if (i === selected) {
                  borderColor = "border-amber-500/50";
                  bgColor = "bg-amber-500/10";
                } else {
                  bgColor = "bg-white/[0.02]";
                  borderColor = "border-white/5";
                }
              }

              return (
                <motion.button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={selected !== null}
                  className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all duration-200 ${borderColor} ${bgColor}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isActive ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  whileTap={selected === null ? { scale: 0.98 } : {}}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex-shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-condensed font-bold mt-0.5 ${
                        selected === i
                          ? "border-amber-500/40 text-amber-400"
                          : "border-white/15 text-vand-sand/50"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm leading-snug text-white/90">
                      {choice.label}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Feedback for selected choice */}
          <AnimatePresence>
            {selected !== null && (
              <motion.div
                ref={feedbackRef}
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-4"
              >
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <p className="text-xs font-condensed uppercase tracking-wider text-amber-400/70 mb-1.5">
                    Here&apos;s what happens
                  </p>
                  <p className="text-sm text-vand-sand/80 leading-relaxed">
                    {scenario.choices[selected].feedback}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Debrief — connects back to core concept */}
          <AnimatePresence>
            {showDebrief && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-3"
              >
                <div className="p-4 rounded-xl bg-vand-gold/5 border border-vand-gold/15">
                  <p className="text-xs font-condensed uppercase tracking-wider text-vand-gold/70 mb-1.5">
                    The Bigger Picture
                  </p>
                  <p className="text-sm text-vand-sand/80 leading-relaxed">
                    {scenario.debrief}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
