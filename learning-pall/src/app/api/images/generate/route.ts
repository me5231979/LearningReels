import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import OpenAI from "openai";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// cwd() may be the parent dir when running `next dev learning-pall`
const GENERATED_DIR = path.join(process.cwd(), "learning-pall", "public", "generated");

/**
 * Generate an image for a card using DALL-E 3.
 * Downloads the result to public/generated/ and saves the path to the DB
 * so it never needs to be regenerated.
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

  // If cardId provided, check DB first
  if (cardId) {
    const existing = await prisma.reelCard.findUnique({
      where: { id: cardId },
      select: { imageUrl: true },
    });
    if (existing?.imageUrl) {
      return NextResponse.json({ imageUrl: existing.imageUrl });
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

    // Download the image and save locally
    const imageRes = await fetch(dalleUrl);
    if (!imageRes.ok) {
      return NextResponse.json(
        { error: "Failed to download image" },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const filename = `${cardId || Date.now()}.png`;

    await mkdir(GENERATED_DIR, { recursive: true });
    await writeFile(path.join(GENERATED_DIR, filename), buffer);

    const imageUrl = `/generated/${filename}`;

    // Save to DB if cardId provided
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
