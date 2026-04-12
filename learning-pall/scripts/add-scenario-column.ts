/**
 * Add scenarioJson column to ReelCard table directly via SQL.
 * Prisma db push has a conflict with legacy _DocumentToTag index.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { readFileSync } from "fs";
import { join } from "path";

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of [".env.local", ".env"]) {
    try {
      const content = readFileSync(join(process.cwd(), f), "utf-8");
      for (const line of content.split("\n")) {
        const m = line.match(/^DATABASE_URL=['"]?([^'"\s]+)['"]?\s*$/);
        if (m) return m[1];
      }
    } catch {}
  }
  throw new Error("DATABASE_URL not found");
}

async function main() {
  const url = getDatabaseUrl();
  const adapter = new PrismaNeon({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  try {
    // Check if column already exists
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name::text AS column_name
      FROM information_schema.columns
      WHERE table_name = 'ReelCard' AND column_name = 'scenarioJson'
    `;

    if (cols.length > 0) {
      console.log("✅ scenarioJson column already exists.");
    } else {
      await prisma.$executeRaw`ALTER TABLE "ReelCard" ADD COLUMN "scenarioJson" TEXT`;
      console.log("✅ Added scenarioJson column to ReelCard table.");
    }
  } finally {
    await prisma.$disconnect();
  }
}
main();
