import { prisma } from "./db";
import { getAnthropicClient } from "./claude";
import {
  REEL_SYSTEM_PROMPT,
  buildReelUserPrompt,
} from "./prompts/reel-generation";
import type { BloomsLevel } from "@/types/course";
import { serializeCoachPersona, type GeneratedCoachPersona } from "./coach";
import { checkUrlAlive } from "./url-check";

export async function generateReelsForTopic(
  topicSlug: string,
  bloomLevel: BloomsLevel,
  count: number = 3
): Promise<string[]> {
  const topic = await prisma.topic.findUnique({
    where: { slug: topicSlug },
  });

  if (!topic || !topic.isActive) {
    console.error(`Topic not found or inactive: ${topicSlug}`);
    return [];
  }

  const client = getAnthropicClient();
  const reelIds: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const userPrompt = buildReelUserPrompt(
        topic.label,
        bloomLevel,
        topic.description,
        i > 0
          ? `This is reel ${i + 1} of ${count} in a series. Cover a DIFFERENT and UNIQUE aspect of the topic than previous reels. Be creative — explore a new angle, framework, case study, or sub-skill.`
          : undefined
      );

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: REEL_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("Failed to parse reel JSON:", text.substring(0, 200));
        continue;
      }

      const reelData = JSON.parse(jsonMatch[0]);

      if (!reelData.title || !reelData.cards || !Array.isArray(reelData.cards)) {
        console.error("Invalid reel structure");
        continue;
      }

      const coachPersonaRaw = (reelData.coachPersona as GeneratedCoachPersona | undefined) ?? null;
      const coachPersona = serializeCoachPersona(coachPersonaRaw, {
        reelTitle: reelData.title,
        reelSummary: reelData.summary || "",
        topicLabel: topic.label,
        coreCompetency: reelData.coreCompetency || null,
        sourceCredit: reelData.sourceCredit || null,
        sourceUrl: reelData.sourceUrl || null,
        bloomLevel,
      });

      // Validate AI-generated URL before persisting
      let verifiedUrl: string | null = null;
      if (reelData.sourceUrl) {
        verifiedUrl = await checkUrlAlive(reelData.sourceUrl);
        if (!verifiedUrl) {
          console.warn(`[generate-reels] dead sourceUrl for "${reelData.title}": ${reelData.sourceUrl}`);
        }
      }

      const reel = await prisma.learningReel.create({
        data: {
          topicId: topic.id,
          title: reelData.title,
          summary: reelData.summary || "",
          bloomLevel,
          estimatedSeconds: reelData.estimatedSeconds || 240,
          contentJson: JSON.stringify(reelData),
          sourceUrl: verifiedUrl,
          sourceCredit: reelData.sourceCredit || null,
          coachPersona,
          status: "published",
        },
      });

      for (let j = 0; j < reelData.cards.length; j++) {
        const card = reelData.cards[j];
        await prisma.reelCard.create({
          data: {
            reelId: reel.id,
            order: j,
            cardType: card.cardType,
            title: card.title || "",
            script: card.script || "",
            visualDescription: card.visualDescription || "",
            animationCue: card.animationCue || null,
            quizJson: card.quizJson ? JSON.stringify(card.quizJson) : null,
            durationMs: card.durationMs || 60000,
          },
        });
      }

      reelIds.push(reel.id);
      console.log(`Generated reel: ${reel.title} (${reel.id})`);
    } catch (err) {
      console.error("Reel generation error:", err);
    }
  }

  return reelIds;
}
