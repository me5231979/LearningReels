import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import OpenAI from "openai";
import { prisma } from "@/lib/db";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "placeholder" });

/**
 * Generate an image for a card using DALL-E 3.
 * Stores the DALL-E URL directly in the DB (works on Vercel's read-only FS).
 * DALL-E URLs expire after ~1hr, so we check liveness and regenerate if needed.
 */
export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { cardId, visualDescription } = await request.json();

  if (!visualDescription || typeof visualDescription !== "string") {
    return NextResponse.json(
      { error: "Missing visualDescription" },
      { status: 400 }
    );
  }

  // If cardId provided, check DB for an existing image that's still alive
  if (cardId) {
    const existing = await prisma.reelCard.findUnique({
      where: { id: cardId },
      select: { imageUrl: true },
    });
    if (existing?.imageUrl) {
      // DALL-E URLs expire — verify it's still reachable
      try {
        const check = await fetch(existing.imageUrl, { method: "HEAD" });
        if (check.ok) {
          return NextResponse.json({ imageUrl: existing.imageUrl });
        }
      } catch {
        // URL expired or unreachable — regenerate below
      }
    }
  }

  try {
    const shortDesc = visualDescription.substring(0, 200);
    const styledPrompt = `Watercolor sketch illustration: ${shortDesc}. Setting and culture: MUST depict Western society and culture exclusively — modern American or Western European professional workplace, university campus, or business environment. People, attire, architecture, signage, and cultural artifacts must reflect contemporary Western (United States, Canada, United Kingdom, Western Europe) corporate or academic life. No East Asian, Middle Eastern, South Asian, or non-Western settings or cultural elements. Style: loose pen-and-ink linework with soft watercolor washes, muted earth tones (warm brown, sage green, dusty blue), gold and amber accent highlights, light textured paper background, professional editorial quality, clean composition, no text or labels.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: styledPrompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image generated" },
        { status: 500 }
      );
    }

    // Save DALL-E URL to DB so it persists for the session
    if (cardId) {
      await prisma.reelCard.update({
        where: { id: cardId },
        data: { imageUrl },
      }).catch(console.error);
    }

    return NextResponse.json({ imageUrl });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Image generation failed";
    console.error("DALL-E error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
