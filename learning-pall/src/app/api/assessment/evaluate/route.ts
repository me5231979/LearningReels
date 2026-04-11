import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/claude";
import { buildEvaluationPrompt } from "@/lib/prompts/evaluation";

export async function POST(request: NextRequest) {
  try {
    const { questions, answers, bloomsLevel, difficulty } =
      await request.json();

    if (!questions || !answers || !bloomsLevel) {
      return NextResponse.json(
        { error: "questions, answers, and bloomsLevel are required" },
        { status: 400 }
      );
    }

    const prompt = buildEvaluationPrompt(
      questions,
      answers,
      bloomsLevel,
      difficulty || 1
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
    console.error("Evaluation error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate answers" },
      { status: 500 }
    );
  }
}
