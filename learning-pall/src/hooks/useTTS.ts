"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type TTSState = {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isPlaying: boolean;
  isAvailable: boolean;
};

// Simple in-memory audio cache (keyed by text hash)
const audioCache = new Map<string, string>();

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return String(hash);
}

/**
 * TTS hook using ElevenLabs API exclusively.
 * Audio is streamed from the server API route to protect the API key.
 * Cached in-memory to avoid re-generating the same narration.
 */
export function useTTS(): TTSState {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAvailable] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      abortRef.current?.abort();
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    const key = hashText(text);

    try {
      // Cancel any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      // Stop currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      let audioUrl = audioCache.get(key);

      if (!audioUrl) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          console.error("ElevenLabs TTS failed:", res.status);
          return;
        }

        const blob = await res.blob();
        audioUrl = URL.createObjectURL(blob);
        audioCache.set(key, audioUrl);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
      };
      audio.onerror = () => {
        setIsPlaying(false);
      };

      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("ElevenLabs TTS error:", err);
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    abortRef.current?.abort();
    setIsPlaying(false);
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused && audioRef.current.currentTime > 0) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  return { speak, stop, pause, resume, isPlaying, isAvailable };
}
