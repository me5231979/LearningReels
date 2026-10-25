/**
 * Fixed-window rate limiting, kept in memory.
 *
 * Each server instance keeps its own counters, so on a serverless host this
 * is a per-instance ceiling rather than a global one. It still stops a single
 * client from hammering an endpoint, which is what guards the paid AI APIs
 * and the auth endpoints against scripted abuse. Pair it with hard spend
 * limits in each provider's console.
 */

import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

/** Returns true when the call is allowed, false once `limit` is reached. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

export function tooManyRequests() {
  return NextResponse.json(
    { error: "Too many requests. Please wait a few minutes and try again." },
    { status: 429 }
  );
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

const HOUR = 60 * 60 * 1000;

/**
 * Per-user hourly budgets for routes that call paid AI APIs. Keys are shared
 * across routes in the same group so one user can't spread load around.
 */
export const AI_LIMITS = {
  text: { limit: 60, windowMs: HOUR }, // Claude chat/eval/generation calls
  generate: { limit: 10, windowMs: HOUR }, // multi-reel generation runs
  tts: { limit: 120, windowMs: HOUR }, // ElevenLabs narration
  image: { limit: 60, windowMs: HOUR }, // DALL-E card images
} as const;

export function aiRateLimit(userId: string, group: keyof typeof AI_LIMITS): boolean {
  const { limit, windowMs } = AI_LIMITS[group];
  return rateLimit(`ai:${group}:${userId}`, limit, windowMs);
}
