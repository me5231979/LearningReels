/**
 * Read-only probe of the Neon database to confirm the schema is provisioned
 * and report how much data is in each of the main tables.
 * Run: npx tsx scripts/probe-neon.ts
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

  const results: Record<string, number | string> = {};
  const probes: Array<[string, () => Promise<number>]> = [
    ["User", () => prisma.user.count()],
    ["Topic", () => prisma.topic.count()],
    ["LearningReel", () => prisma.learningReel.count()],
    ["ReelCard", () => prisma.reelCard.count()],
    ["Comm", () => prisma.comm.count()],
    ["ContentReport", () => prisma.contentReport.count()],
  ];

  for (const [name, fn] of probes) {
    try {
      results[name] = await fn();
    } catch (e) {
      results[name] = `ERROR: ${(e as Error).message.slice(0, 120)}`;
    }
  }

  console.log(JSON.stringify(results, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
