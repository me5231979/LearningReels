/**
 * Audit all sourceUrl references in the production database.
 *
 * Fetches every LearningReel.sourceUrl from Neon and checks whether
 * each URL responds with HTTP 200. Reports dead links.
 *
 * Usage: npx tsx scripts/audit-urls.ts
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

type CheckResult = {
  reelId: string;
  title: string;
  sourceUrl: string;
  status: "alive" | "dead" | "redirect" | "error";
  httpCode?: number;
  finalUrl?: string;
  error?: string;
};

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
  const url = getDatabaseUrl();
  const adapter = new PrismaNeon({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  try {
    const reels = await prisma.learningReel.findMany({
      where: { sourceUrl: { not: null } },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        status: true,
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(`Found ${reels.length} reels with sourceUrl set.\n`);

    const results: CheckResult[] = [];
    let checked = 0;

    // Check URLs with concurrency limit
    const CONCURRENCY = 5;
    const queue = [...reels];

    async function worker() {
      while (queue.length > 0) {
        const reel = queue.shift()!;
        if (!reel.sourceUrl) continue;
        checked++;
        const check = await checkUrl(reel.sourceUrl);
        const result: CheckResult = {
          reelId: reel.id,
          title: reel.title,
          sourceUrl: reel.sourceUrl,
          ...check,
        };
        results.push(result);

        const icon =
          check.status === "alive" ? "✅" :
          check.status === "redirect" ? "↪️ " :
          check.status === "dead" ? "❌" : "⚠️ ";
        const code = check.httpCode ? ` [${check.httpCode}]` : "";
        const err = check.error ? ` (${check.error})` : "";
        console.log(`${icon} ${checked}/${reels.length}${code}${err} ${reel.sourceUrl}`);
        if (check.finalUrl) {
          console.log(`   ↳ redirected to: ${check.finalUrl}`);
        }
      }
    }

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all(workers);

    // Summary
    const dead = results.filter((r) => r.status === "dead" || r.status === "error");
    const alive = results.filter((r) => r.status === "alive");
    const redirects = results.filter((r) => r.status === "redirect");

    console.log("\n" + "=".repeat(70));
    console.log("AUDIT SUMMARY");
    console.log("=".repeat(70));
    console.log(`Total reels with URLs: ${results.length}`);
    console.log(`  ✅ Alive:    ${alive.length}`);
    console.log(`  ↪️  Redirect: ${redirects.length}`);
    console.log(`  ❌ Dead:     ${dead.length}`);

    if (dead.length > 0) {
      console.log("\n" + "-".repeat(70));
      console.log("DEAD LINKS — need replacement:");
      console.log("-".repeat(70));
      for (const d of dead) {
        console.log(`\n  Reel:  "${d.title}"`);
        console.log(`  ID:    ${d.reelId}`);
        console.log(`  URL:   ${d.sourceUrl}`);
        console.log(`  Issue: ${d.httpCode ? `HTTP ${d.httpCode}` : d.error}`);
      }
    }

    if (redirects.length > 0) {
      console.log("\n" + "-".repeat(70));
      console.log("REDIRECTS — should update to final URL:");
      console.log("-".repeat(70));
      for (const r of redirects) {
        console.log(`\n  Reel:  "${r.title}"`);
        console.log(`  ID:    ${r.reelId}`);
        console.log(`  Old:   ${r.sourceUrl}`);
        console.log(`  Final: ${r.finalUrl}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
