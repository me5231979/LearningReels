import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAnthropicClient } from "@/lib/claude";
import { buildOnboardingPrompt } from "@/lib/prompts/onboarding";
import { generateReelsForTopic } from "@/lib/generate-reels";
import type { BloomsLevel } from "@/types/course";

export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { message, conversationId } = await request.json();

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  // Load available topics
  const topics = await prisma.topic.findMany({
    where: { isActive: true },
    select: { slug: true, label: true, description: true },
  });

  const topicLabels = topics.map(
    (t) => `${t.slug} (${t.label}: ${t.description})`
  );

  // Load or create conversation
  let conversation;
  let messages: { role: string; content: string }[] = [];

  if (conversationId) {
    conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: session.uid },
    });
    if (conversation) {
      messages = JSON.parse(conversation.messages);
    }
  }

  // Add user message
  messages.push({ role: "user", content: message });

  // Build Claude messages
  const claudeMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: buildOnboardingPrompt(topicLabels),
    messages: claudeMessages,
  });

  const assistantText =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse the JSON response
  let parsed;
  try {
    // Extract JSON from the response (handle potential markdown wrapping)
    const jsonMatch = assistantText.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { reply: assistantText, isComplete: false };
  } catch {
    parsed = { reply: assistantText, isComplete: false };
  }

  // Add assistant message (store the reply text, not the full JSON)
  messages.push({ role: "assistant", content: parsed.reply });

  // Save conversation
  if (conversation) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        messages: JSON.stringify(messages),
        context: parsed.extractedData
          ? JSON.stringify(parsed.extractedData)
          : conversation.context,
      },
    });
  } else {
    conversation = await prisma.conversation.create({
      data: {
        userId: session.uid,
        messages: JSON.stringify(messages),
        context: parsed.extractedData
          ? JSON.stringify(parsed.extractedData)
          : null,
      },
    });
  }

  // If onboarding complete, save user preferences and bloom levels
  if (parsed.isComplete && parsed.extractedData) {
    const { topics: topicSlugs, bloomLevel } = parsed.extractedData;

    // Update user preferences and mark as onboarded
    await prisma.user.update({
      where: { id: session.uid },
      data: {
        preferences: JSON.stringify({
          topics: topicSlugs,
          bloomLevel,
        }),
        onboardedAt: new Date(),
      },
    });

    // Create bloom level entries for selected topics
    for (const slug of topicSlugs) {
      const topic = await prisma.topic.findUnique({ where: { slug } });
      if (topic) {
        await prisma.userBloomLevel.upsert({
          where: {
            userId_topicId: { userId: session.uid, topicId: topic.id },
          },
          update: { currentLevel: bloomLevel },
          create: {
            userId: session.uid,
            topicId: topic.id,
            currentLevel: bloomLevel,
          },
        });
      }
    }

    // Trigger reel generation for first topic (fire-and-forget, runs async)
    if (topicSlugs.length > 0) {
      const firstTopic = topics.find((t) => topicSlugs.includes(t.slug));
      if (firstTopic) {
        generateReelsForTopic(
          firstTopic.slug,
          bloomLevel as BloomsLevel,
          3
        ).catch(console.error);
      }
    }
  }

  return NextResponse.json({
    reply: parsed.reply,
    conversationId: conversation.id,
    isComplete: parsed.isComplete || false,
    extractedData: parsed.extractedData || null,
  });
}
