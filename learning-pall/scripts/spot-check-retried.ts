/**
 * Spot-check the 13 retried reels on Neon: dump title, summary, and the
 * narration card script for each so we can eyeball the rewritten text.
 * Run: npx tsx scripts/spot-check-retried.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { readFileSync } from "fs";
import path from "path";

function getDbUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, "..", ".env.local");
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^DATABASE_URL=['"]?([^'"]+?)['"]?$/);
    if (m) return m[1];
  }
  throw new Error("DATABASE_URL not found");
}

const IDS = [
  "cmnsbmbob008ci3kwa3oi30tx",
  "cmnse3d0t002hjikwsbzxy03i",
  "cmnse3l7w009llnkw6oaflpfg",
  "cmnse3sbs002mjikw3xukv7q3",
  "cmnse480j002rjikw8fhy4bf3",
  "cmnse4naw002wjikwa5p4b8ll",
  "cmnse4x7d00a0lnkwtt1kfomx",
  "cmnse5cso00a5lnkwuo132ja9",
  "cmnse5t7v00aalnkw9f02ppkj",
  "cmnse69im00aflnkwslguqd73",
  "cmnse6oxi00aklnkwy706mpjp",
  "cmnse74om00aplnkw9jdznw80",
  "cmnse7ja700aulnkwreajj9pn",
];

async function main() {
  const adapter = new PrismaNeon({ connectionString: getDbUrl() });
  const prisma = new PrismaClient({ adapter });

  for (const id of IDS) {
    const reel = await prisma.learningReel.findUnique({
      where: { id },
      include: { cards: { orderBy: { order: "asc" } } },
    });
    if (!reel) {
      console.log(`${id} NOT FOUND`);
      continue;
    }
    console.log(`\n=== ${reel.title} ===`);
    console.log(`  summary: ${reel.summary}`);
    const narration = reel.cards.find((c) => c.cardType === "narration");
    if (narration) {
      console.log(`  narration[${narration.order}] "${narration.title}"`);
      console.log(`    ${narration.script.slice(0, 280)}...`);
    }
    const interaction = reel.cards.find((c) => c.cardType === "interaction");
    if (interaction?.quizJson) {
      const q = JSON.parse(interaction.quizJson);
      console.log(`  quiz Q: ${q.question}`);
      console.log(`  choices: ${(q.choices || []).length} correctIndex=${q.correctIndex}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
