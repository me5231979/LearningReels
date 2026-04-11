import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
// "Rachel" — clear, professional female voice. Change voice_id as needed.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "ElevenLabs API key not configured" },
      { status: 500 }
    );
  }

  const { text } = await request.json();

  if (!text || typeof text !== "string" || text.length > 2000) {
    return NextResponse.json(
      { error: "Invalid text (max 2000 chars)" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      return NextResponse.json(
        { error: "TTS generation failed" },
        { status: 502 }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400", // Cache for 24h
      },
    });
  } catch (err) {
    console.error("ElevenLabs TTS error:", err);
    return NextResponse.json(
      { error: "TTS generation failed" },
      { status: 500 }
    );
  }
}
