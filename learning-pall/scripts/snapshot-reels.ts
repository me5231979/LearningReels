/**
 * Snapshot all published + draft reels (with their cards) to a JSON backup file.
 * Run: npx tsx scripts/snapshot-reels.ts
 *
 * Output: backups/reels-pre-rewrite-<timestamp>.json
 */

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { mkdirSync, writeFileSync } from "fs";

const dbPath = path.join(__dirname, "..", "data", "learning-pall.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const reels = await prisma.learningReel.findMany({
    where: { status: { in: ["published", "draft"] } },
    include: {
      cards: { orderBy: { order: "asc" } },
      topic: { select: { id: true, label: true, slug: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  const byStatus = reels.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Snapshotting ${reels.length} reels:`, byStatus);

  const backupDir = path.join(__dirname, "..", "backups");
  mkdirSync(backupDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(backupDir, `reels-pre-rewrite-${ts}.json`);

  const payload = {
    snapshotAt: new Date().toISOString(),
    counts: { total: reels.length, ...byStatus },
    reels: reels.map((r) => ({
      id: r.id,
      topicId: r.topicId,
      topic: r.topic,
      title: r.title,
      summary: r.summary,
      bloomLevel: r.bloomLevel,
      estimatedSeconds: r.estimatedSeconds,
      contentJson: r.contentJson,
      sourceUrl: r.sourceUrl,
      sourceCredit: r.sourceCredit,
      coreCompetency: r.coreCompetency,
      coachPersona: r.coachPersona,
      targetDepartments: r.targetDepartments,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      cards: r.cards.map((c) => ({
        id: c.id,
        order: c.order,
        cardType: c.cardType,
        title: c.title,
        script: c.script,
        visualDescription: c.visualDescription,
        animationCue: c.animationCue,
        quizJson: c.quizJson,
        durationMs: c.durationMs,
      })),
    })),
  };

  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");

  const sizeKb = Math.round(Buffer.byteLength(JSON.stringify(payload)) / 1024);
  console.log(`Wrote ${outPath} (${sizeKb} KB)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
