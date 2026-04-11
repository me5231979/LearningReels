import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

function getApiKey(): string {
  // Try env var first
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  // Fallback: read directly from .env.local (dev-only; Vercel has no such file)
  try {
    const envPath = join(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^ANTHROPIC_API_KEY=['"]?([^'"\s]+?)['"]?\s*$/);
      if (match) return match[1];
    }
  } catch {
    // ignore
  }

  throw new Error("ANTHROPIC_API_KEY not found in environment or .env.local");
}

export function getAnthropicClient() {
  return new Anthropic({ apiKey: getApiKey() });
}
