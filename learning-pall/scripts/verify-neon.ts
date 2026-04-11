/**
 * Deeper Neon verification: status breakdowns and a spot-check of one
 * rewritten reel (title/summary + first narration card script).
 * Run: npx tsx scripts/verify-neon.ts
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

async function main() {
  const adapter = new PrismaNeon({ connectionString: getDbUrl() });
  const prisma = new PrismaClient({ adapter });

  const reelStatus = await prisma.learningReel.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.log("LearningReel status counts:");
  for (const r of reelStatus) console.log(`  ${r.status}: ${r._count._all}`);

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, status: true },
  });
  console.log(`\nUsers (${users.length}):`);
  for (const u of users) console.log(`  ${u.email} [${u.role}/${u.status}]`);

  // Spot check: grab a published reel with its first narration card
  const reel = await prisma.learningReel.findFirst({
    where: { status: "published" },
    include: {
      topic: { select: { label: true } },
      cards: { orderBy: { order: "asc" }, take: 3 },
    },
  });
  if (reel) {
    console.log(`\nSpot-check reel: "${reel.title}" (topic: ${reel.topic.label})`);
    console.log(`  summary: ${reel.summary.slice(0, 200)}...`);
    console.log(`  card count: ${reel.cards.length}`);
    if (reel.cards[1]) {
      console.log(`  card[1] (${reel.cards[1].cardType}): "${reel.cards[1].title}"`);
      console.log(`    script: ${reel.cards[1].script.slice(0, 240)}...`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
