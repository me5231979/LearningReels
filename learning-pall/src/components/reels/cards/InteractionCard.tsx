"use client";

import { useState, useRef, useEffect } from "react";
import type { ReelCardData } from "../ReelFeed";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Brain } from "lucide-react";

type QuizData = {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

type Props = {
  card: ReelCardData;
  isActive: boolean;
  onNext: () => void;
  onPrev: () => void;
  onAnswer: (answer: string) => void;
};

export default function InteractionCard({
  card,
  isActive,
  onNext,
  onAnswer,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const explanationRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to explanation when answer is revealed
  useEffect(() => {
    if (revealed && explanationRef.current) {
      setTimeout(() => {
        explanationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
    }
  }, [revealed]);

  const quiz: QuizData | null = card.quizJson
    ? JSON.parse(card.quizJson)
    : null;

  if (!quiz) {
    // Fallback: open-ended generation prompt
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        {/* Background visual */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-vand-black to-vand-black" />

        <div className="relative h-full flex flex-col items-center justify-center px-8 z-10">
          <motion.div
            className="text-center max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={isActive ? { opacity: 1, y: 0 } : {}}
          >
            <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center mx-auto mb-5">
              <Brain size={24} className="text-purple-400" />
            </div>
            <p className="font-condensed text-xs uppercase tracking-wider text-vand-gold mb-4">
              Think About It
            </p>
            <h3 className="font-serif text-2xl font-bold text-white mb-6">
              {card.script}
            </h3>
            <button
              onClick={onNext}
              className="px-6 py-3 rounded-lg bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-sm font-bold hover:bg-vand-highlight transition-colors"
            >
              I&apos;ve thought about it
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  const isCorrect = selected === quiz.correctIndex;

  function handleSelect(index: number) {
    if (revealed) return;
    setSelected(index);
    setRevealed(true);
    onAnswer(String(index));
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/15 via-vand-black to-vand-black" />

      <div ref={scrollContainerRef} className="relative h-full overflow-y-auto px-6 py-4 z-10">
        <motion.div
          className="max-w-sm mx-auto w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={isActive ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
        >
          {/* Badge */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-vand-gold/15 border border-vand-gold/20 flex items-center justify-center">
              <Brain size={14} className="text-vand-gold" />
            </div>
            <p className="font-condensed text-xs uppercase tracking-wider text-vand-gold">
              Knowledge Check
            </p>
          </div>

          <h3 className="font-serif text-lg font-bold text-white mb-4 leading-snug">
            {quiz.question}
          </h3>

          <div className="space-y-2">
            {quiz.choices.map((choice, i) => {
              let borderColor = "border-white/10";
              let bgColor = "bg-white/5";
              let textColor = "text-white";
              let ringClass = "";

              if (revealed) {
                if (i === quiz.correctIndex) {
                  borderColor = "border-green-500/60";
                  bgColor = "bg-green-500/10";
                  ringClass = "ring-1 ring-green-500/30";
                } else if (i === selected && !isCorrect) {
                  borderColor = "border-red-500/50";
                  bgColor = "bg-red-500/10";
                  textColor = "text-red-300";
                }
              } else if (i === selected) {
                borderColor = "border-vand-gold/50";
                bgColor = "bg-vand-gold/10";
              }

              return (
                <motion.button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={revealed}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-200 ${borderColor} ${bgColor} ${textColor} ${ringClass}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isActive ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  whileTap={!revealed ? { scale: 0.98 } : {}}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-lg border border-current/20 flex items-center justify-center text-xs font-condensed font-bold">
                      {revealed && i === quiz.correctIndex ? (
                        <Check size={14} className="text-green-400" />
                      ) : revealed && i === selected && !isCorrect ? (
                        <X size={14} className="text-red-400" />
                      ) : (
                        String.fromCharCode(65 + i)
                      )}
                    </span>
                    <span className="text-sm leading-snug">{choice}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Explanation after reveal */}
          <AnimatePresence>
            {revealed && (
              <motion.div
                ref={explanationRef}
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-5"
              >
                <div
                  className={`p-4 rounded-xl border backdrop-blur-sm ${
                    isCorrect
                      ? "bg-green-500/5 border-green-500/20"
                      : "bg-amber-500/5 border-amber-500/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isCorrect ? (
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check size={12} className="text-green-400" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <span className="text-xs">💡</span>
                      </div>
                    )}
                    <p className="text-xs font-condensed uppercase tracking-wider text-vand-sand/60">
                      {isCorrect ? "Correct!" : "Not quite — here's why"}
                    </p>
                  </div>
                  <p className="text-sm text-vand-sand/80 leading-relaxed">
                    {quiz.explanation}
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
