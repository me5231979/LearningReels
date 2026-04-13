"use client";

import { useEffect, useRef, useState } from "react";
import type { ReelCardData } from "../ReelFeed";
import { motion } from "framer-motion";

type Props = {
  card: ReelCardData;
  isActive: boolean;
  onNext: () => void;
  onPrev: () => void;
  reelTitle?: string;
};

export default function HookCard({ card, isActive, onNext, reelTitle }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [bgImage, setBgImage] = useState<string | null>(null);

  // Auto-advance after duration
  useEffect(() => {
    if (!isActive) return;
    timerRef.current = setTimeout(onNext, card.durationMs || 5000);
    return () => clearTimeout(timerRef.current);
  }, [isActive, onNext, card.durationMs]);

  // Generate a background image from the visual description.
  // Don't abort on unmount — let DALL-E finish so the URL is saved to DB
  // for next time (generation takes 10-18s, longer than the hook card timer).
  const imageRequested = useRef(false);
  useEffect(() => {
    if (card.imageUrl) {
      setBgImage(card.imageUrl);
      return;
    }
    if (!card.visualDescription) return;
    if (!isActive) return;
    if (imageRequested.current) return;
    imageRequested.current = true;

    fetch("/api/images/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: card.id,
        visualDescription: card.visualDescription,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.imageUrl) setBgImage(data.imageUrl);
      })
      .catch(console.error);
  }, [card.imageUrl, card.visualDescription, card.id, isActive]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Visual area — top portion (4/9 of available height) */}
      <div className="flex-[4] relative overflow-hidden min-h-0">
        {bgImage ? (
          <>
            <img
              src={bgImage}
              alt={card.visualDescription}
              className="w-full h-full object-cover"
              onError={() => setBgImage(null)}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-vand-black" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-900/40 via-vand-black to-vand-black" />
        )}
      </div>

      {/* Text area — bottom portion (5/9), can scroll if content overflows */}
      <div className="flex-[5] px-6 pt-3 pb-3 overflow-y-auto min-h-0 text-center">
        {reelTitle && (
          <p className="text-[11px] font-condensed font-bold uppercase tracking-widest text-vand-gold mb-2">
            {reelTitle}
          </p>
        )}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={isActive ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <h2 className="font-serif text-2xl font-bold text-white leading-tight mb-2">
            {card.title}
          </h2>
        </motion.div>

        <motion.div
          className="w-10 h-0.5 bg-vand-gold mx-auto mb-2"
          initial={{ scaleX: 0 }}
          animate={isActive ? { scaleX: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.2 }}
        />

        <motion.p
          className="text-vand-sand/85 text-[13px] leading-relaxed"
          initial={{ opacity: 0, y: 8 }}
          animate={isActive ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          {card.script}
        </motion.p>
      </div>
    </div>
  );
}
