/**
 * Fix dead sourceUrl references in production.
 *
 * 1. Nulls out sourceUrls that returned HTTP errors (dead/hallucinated)
 * 2. Updates redirected sourceUrls to their final destination
 *
 * Usage: npx tsx scripts/fix-dead-urls.ts
 * Dry run: npx tsx scripts/fix-dead-urls.ts --dry
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

async function checkUrl(url: string): Promise<{
  status: "alive" | "dead" | "redirect" | "error";
  httpCode?: number;
  finalUrl?: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);
    const finalUrl = res.url !== url ? res.url : undefined;
    if (res.ok) {
      return { status: finalUrl ? "redirect" : "alive", httpCode: res.status, finalUrl };
    }
    return { status: "dead", httpCode: res.status, finalUrl };
  } catch (e) {
    return { status: "error", error: (e as Error).message };
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry");
  if (dryRun) console.log("🔍 DRY RUN — no changes will be written.\n");

  const url = getDatabaseUrl();
  const adapter = new PrismaNeon({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  try {
    const reels = await prisma.learningReel.findMany({
      where: { sourceUrl: { not: null } },
      select: { id: true, title: true, sourceUrl: true },
      orderBy: { createdAt: "asc" },
    });

    console.log(`Checking ${reels.length} reels with sourceUrl...\n`);

    let nulled = 0;
    let updated = 0;
    let kept = 0;
    let checked = 0;

    const CONCURRENCY = 5;
    const queue = [...reels];

    async function worker() {
      while (queue.length > 0) {
        const reel = queue.shift()!;
        if (!reel.sourceUrl) continue;
        checked++;
        const check = await checkUrl(reel.sourceUrl);

        if (check.status === "dead" || check.status === "error") {
          const reason = check.httpCode ? `HTTP ${check.httpCode}` : check.error || "unknown";
          console.log(`❌ ${checked}/${reels.length} NULL  "${reel.title.slice(0, 50)}" — ${reason}`);
          console.log(`   ${reel.sourceUrl}`);
          if (!dryRun) {
            await prisma.learningReel.update({
              where: { id: reel.id },
              data: { sourceUrl: null },
            });
          }
          nulled++;
        } else if (check.status === "redirect" && check.finalUrl) {
          console.log(`↪️  ${checked}/${reels.length} FIX   "${reel.title.slice(0, 50)}"`);
          console.log(`   ${reel.sourceUrl} → ${check.finalUrl}`);
          if (!dryRun) {
            await prisma.learningReel.update({
              where: { id: reel.id },
              data: { sourceUrl: check.finalUrl },
            });
          }
          updated++;
        } else {
          kept++;
        }
      }
    }

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all(workers);

    console.log("\n" + "=".repeat(60));
    console.log(dryRun ? "DRY RUN SUMMARY" : "FIX SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total checked:   ${checked}`);
    console.log(`  ✅ Kept (alive): ${kept}`);
    console.log(`  ↪️  Updated (redirect → final URL): ${updated}`);
    console.log(`  ❌ Nulled (dead/error): ${nulled}`);
    if (dryRun) {
      console.log("\nRe-run without --dry to apply changes.");
    } else {
      console.log("\n✅ Database updated. Dead links removed, redirects fixed.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
