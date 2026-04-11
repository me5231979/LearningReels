"use client";

import type { ReelCardData } from "../ReelFeed";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

type Props = {
  card: ReelCardData;
  isActive: boolean;
  onNext: () => void;
  onPrev: () => void;
};

export default function FeedbackCard({ card, isActive }: Props) {
  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Celebration background */}
      <div className="absolute inset-0 bg-gradient-to-b from-vand-gold/10 via-vand-black to-vand-black" />

      {/* Animated sparkle particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {isActive &&
          [...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-vand-gold/30"
              style={{
                left: `${10 + i * 12}%`,
                top: `${15 + (i * 11) % 50}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0, 0.6, 0],
                scale: [0.5, 1.2, 0.5],
              }}
              transition={{
                duration: 2.5 + i * 0.3,
                repeat: Infinity,
                delay: i * 0.3,
              }}
            />
          ))}
      </div>

      <div className="relative h-full flex flex-col items-center justify-center px-8 py-6 overflow-y-auto z-10">
        <motion.div
          className="text-center max-w-sm w-full"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isActive ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.4 }}
        >
          {/* Icon */}
          <motion.div
            className="w-14 h-14 rounded-2xl bg-vand-gold/15 border border-vand-gold/25 flex items-center justify-center mx-auto mb-4"
            animate={
              isActive
                ? { scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }
                : {}
            }
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Sparkles size={24} className="text-vand-gold" />
          </motion.div>

          <motion.p
            className="font-condensed text-xs uppercase tracking-wider text-vand-gold/70 mb-2"
            initial={{ opacity: 0 }}
            animate={isActive ? { opacity: 1 } : {}}
            transition={{ delay: 0.2 }}
          >
            Key Takeaway
          </motion.p>

          <h3 className="font-serif text-xl font-bold text-white mb-3">
            {card.title}
          </h3>

          {/* Gold divider */}
          <motion.div
            className="w-10 h-0.5 bg-vand-gold/40 mx-auto mb-4"
            initial={{ scaleX: 0 }}
            animate={isActive ? { scaleX: 1 } : {}}
            transition={{ delay: 0.3 }}
          />

          <p className="text-vand-sand/80 text-sm leading-relaxed">
            {card.script}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
