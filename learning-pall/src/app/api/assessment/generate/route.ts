import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/claude";
import { buildAssessmentPrompt } from "@/lib/prompts/assessment";

export async function POST(request: NextRequest) {
  try {
    const { bloomsLevel, difficulty, moduleContent, keyConcepts } =
      await request.json();

    if (!bloomsLevel || !moduleContent) {
      return NextResponse.json(
        { error: "bloomsLevel and moduleContent are required" },
        { status: 400 }
      );
    }

    const prompt = buildAssessmentPrompt(
      bloomsLevel,
      difficulty || 1,
      moduleContent,
      keyConcepts || []
    );

    const message = await getAnthropicClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response");
    }

    let jsonStr = textContent.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const data = JSON.parse(jsonStr);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Assessment generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate assessment" },
      { status: 500 }
    );
  }
}
