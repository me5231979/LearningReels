"use client";

import { useEffect, useState } from "react";
import type { ReelCardData } from "../ReelFeed";
import { motion } from "framer-motion";
import { useTTS } from "@/hooks/useTTS";
import { Volume2, VolumeX } from "lucide-react";

type Props = {
  card: ReelCardData;
  isActive: boolean;
  onNext: () => void;
  onPrev: () => void;
};

// Cache generated image URLs across renders
const imageUrlCache = new Map<string, string>();

export default function NarrationCard({ card, isActive }: Props) {
  const { speak, stop, isPlaying, isAvailable } = useTTS();
  const [imageUrl, setImageUrl] = useState<string | null>(
    card.imageUrl || imageUrlCache.get(card.id) || null
  );
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  // Auto-speak when card becomes active
  useEffect(() => {
    if (isActive && card.script) {
      speak(card.script);
    }
    return () => {
      stop();
    };
  }, [isActive, card.script, speak, stop]);

  // Generate image if none exists — only for the active reel, so we don't
  // saturate the dev server with hundreds of concurrent DALL-E requests
  // (which blocks Next.js RSC navigation requests in the same queue).
  useEffect(() => {
    if (imageUrl || !card.visualDescription) return;
    if (!isActive) return;

    const cached = imageUrlCache.get(card.id);
    if (cached) {
      setImageUrl(cached);
      return;
    }

    const controller = new AbortController();
    fetch("/api/images/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, visualDescription: card.visualDescription }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.imageUrl) {
          imageUrlCache.set(card.id, data.imageUrl);
          setImageUrl(data.imageUrl);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") console.error(err);
      });

    return () => controller.abort();
  }, [card.id, card.visualDescription, imageUrl, isActive]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Visual area — top portion with generated sketch image */}
      <div className="flex-[4] relative overflow-hidden min-h-0">
        {imageUrl && !imageFailed ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-vand-oak/20 to-vand-black flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-vand-gold/30 border-t-vand-gold rounded-full animate-spin" />
              </div>
            )}
            <motion.img
              src={imageUrl}
              alt=""
              className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
              initial={{ scale: 1.05 }}
              animate={isActive ? { scale: 1 } : {}}
              transition={{ duration: 0.8 }}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageFailed(true);
                setImageLoaded(false);
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-vand-black" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-vand-oak/20 to-vand-black">
            <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-vand-black to-transparent" />
          </div>
        )}

        {/* TTS button */}
        {isAvailable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isPlaying) stop();
              else speak(card.script);
            }}
            className="absolute top-2 right-2 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center"
          >
            {isPlaying ? (
              <Volume2 size={14} className="text-vand-gold animate-pulse" />
            ) : (
              <VolumeX size={14} className="text-vand-sand/50" />
            )}
          </button>
        )}
      </div>

      {/* Narration text — bottom portion, scrollable */}
      <div className="flex-[5] px-5 pt-3 pb-2 overflow-y-auto min-h-0">
        <motion.h3
          className="font-serif text-lg font-bold text-white mb-2 leading-tight"
          initial={{ opacity: 0, y: 8 }}
          animate={isActive ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.3 }}
        >
          {card.title}
        </motion.h3>

        <motion.div
          className="w-8 h-0.5 bg-vand-gold/40 mb-2"
          initial={{ scaleX: 0 }}
          animate={isActive ? { scaleX: 1 } : {}}
          transition={{ duration: 0.3, delay: 0.15 }}
          style={{ transformOrigin: "left" }}
        />

        <motion.p
          className="text-vand-sand/80 text-[13px] leading-relaxed"
          initial={{ opacity: 0, y: 8 }}
          animate={isActive ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {card.script}
        </motion.p>

        {/* Audio waveform when speaking */}
        {isPlaying && (
          <motion.div
            className="flex items-center gap-0.5 mt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {[...Array(10)].map((_, i) => (
              <motion.div
                key={i}
                className="w-0.5 bg-vand-gold/40 rounded-full"
                animate={{ height: [3, 10 + Math.random() * 6, 3] }}
                transition={{
                  duration: 0.5 + Math.random() * 0.3,
                  repeat: Infinity,
                  delay: i * 0.05,
                }}
              />
            ))}
            <span className="text-[9px] text-vand-sand/30 ml-1.5 font-condensed">
              Speaking...
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
