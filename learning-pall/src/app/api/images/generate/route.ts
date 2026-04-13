import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import OpenAI from "openai";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "placeholder" });

/**
 * Generate an image for a card using DALL-E 3.
 * Uploads to Vercel Blob for permanent public storage (no expiration).
 * Falls back to DALL-E URL if Blob token isn't configured.
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

  // If cardId provided, check DB for an existing permanent image
  if (cardId) {
    const existing = await prisma.reelCard.findUnique({
      where: { id: cardId },
      select: { imageUrl: true },
    });
    if (existing?.imageUrl) {
      // Blob URLs are permanent — no liveness check needed
      // Only re-check if it's an old DALL-E URL (they expire)
      if (!existing.imageUrl.includes("oaidalleapi")) {
        return NextResponse.json({ imageUrl: existing.imageUrl });
      }
      // DALL-E URL — check if still alive, otherwise regenerate
      try {
        const check = await fetch(existing.imageUrl, { method: "HEAD" });
        if (check.ok) {
          return NextResponse.json({ imageUrl: existing.imageUrl });
        }
      } catch {
        // expired — regenerate below
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

    const dalleUrl = response.data[0]?.url;
    if (!dalleUrl) {
      return NextResponse.json(
        { error: "No image generated" },
        { status: 500 }
      );
    }

    let imageUrl = dalleUrl;

    // Upload to Vercel Blob for permanent storage (if token configured)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const imageRes = await fetch(dalleUrl);
        if (imageRes.ok) {
          const buffer = Buffer.from(await imageRes.arrayBuffer());
          const filename = `reel-images/${cardId || Date.now()}.png`;
          const blob = await put(filename, buffer, { access: "public" });
          imageUrl = blob.url;
        }
      } catch (blobErr) {
        console.error("Blob upload failed, using DALL-E URL:", blobErr);
        // Fall back to DALL-E URL (temporary but still works for ~1hr)
      }
    }

    // Save permanent URL to DB
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
