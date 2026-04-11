/**
 * One-shot migration of every populated table from the local SQLite dev db
 * (data/learning-pall.db) into the Neon database pointed at by DATABASE_URL.
 *
 * Source: raw better-sqlite3 (the Prisma client is generated for postgres now
 *         and can't read the SQLite file).
 * Target: Prisma client (postgres, via PrismaNeon).
 *
 * Run:
 *   npx tsx scripts/migrate-sqlite-to-neon.ts           # migrate everything
 *   npx tsx scripts/migrate-sqlite-to-neon.ts --dry-run # just report counts
 *   npx tsx scripts/migrate-sqlite-to-neon.ts --table User  # one table only
 *
 * SAFETY:
 *   - Pre-flight: aborts if Neon has any existing rows in a target table
 *     (unless --force is passed). This protects against re-migration clobber.
 *   - Batched inserts (500 rows / batch) for ReelCard and other large tables.
 *   - Runs in FK-safe order so parents exist before children.
 */

import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import path from "path";
import { readFileSync } from "fs";

// ── DB connections ─────────────────────────────────────────
const sqlitePath = path.join(__dirname, "..", "data", "learning-pall.db");
const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });

function getDbUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, "..", ".env.local");
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^DATABASE_URL=['"]?([^'"]+?)['"]?$/);
    if (m) return m[1];
  }
  throw new Error("DATABASE_URL not found");
}
const neonAdapter = new PrismaNeon({ connectionString: getDbUrl() });
const prisma = new PrismaClient({ adapter: neonAdapter });

// ── Type coercion helpers ──────────────────────────────────
function toDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  // SQLite DATETIME columns come back as strings or numbers
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? null : d;
}
function toBool(v: unknown): boolean {
  // SQLite Booleans are INTEGER 0/1
  return v === 1 || v === true || v === "1" || v === "true";
}

// ── Per-table transforms ───────────────────────────────────
// Each transformer takes a raw SQLite row and returns a Prisma-compatible
// object. We only transform fields whose native Postgres type differs from
// SQLite's storage (dates, booleans). Everything else passes through.

type Transformer = (row: any) => any;

const transformers: Record<string, Transformer> = {
  User: (r) => ({
    id: r.id,
    email: r.email,
    passwordHash: r.passwordHash,
    name: r.name,
    role: r.role,
    status: r.status,
    jobTitle: r.jobTitle,
    department: r.department,
    preferences: r.preferences,
    points: r.points,
    streak: r.streak,
    onboardedAt: toDate(r.onboardedAt),
    lastActiveAt: toDate(r.lastActiveAt),
    deletedAt: toDate(r.deletedAt),
    createdAt: toDate(r.createdAt)!,
  }),
  Topic: (r) => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    description: r.description,
    category: r.category,
    icon: r.icon,
    isActive: toBool(r.isActive),
    isCustom: toBool(r.isCustom),
    userId: r.userId,
    createdAt: toDate(r.createdAt)!,
  }),
  LearningReel: (r) => ({
    id: r.id,
    topicId: r.topicId,
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
    isFeatured: toBool(r.isFeatured),
    createdById: r.createdById,
    createdAt: toDate(r.createdAt)!,
    updatedAt: toDate(r.updatedAt)!,
  }),
  ReelSource: (r) => ({
    id: r.id,
    reelId: r.reelId,
    sourceType: r.sourceType,
    originalName: r.originalName,
    originalUrl: r.originalUrl,
    originalPath: r.originalPath,
    brandedPdfPath: r.brandedPdfPath,
    snapshotPdfPath: r.snapshotPdfPath,
    extractedText: r.extractedText,
    createdAt: toDate(r.createdAt)!,
  }),
  ReelCard: (r) => ({
    id: r.id,
    reelId: r.reelId,
    order: r.order,
    cardType: r.cardType,
    title: r.title,
    script: r.script,
    visualDescription: r.visualDescription,
    imageUrl: r.imageUrl,
    animationCue: r.animationCue,
    quizJson: r.quizJson,
    durationMs: r.durationMs,
  }),
  CoachConversation: (r) => ({
    id: r.id,
    userId: r.userId,
    reelId: r.reelId,
    messages: r.messages,
    turnsUsed: r.turnsUsed,
    createdAt: toDate(r.createdAt)!,
    updatedAt: toDate(r.updatedAt)!,
  }),
  UserReaction: (r) => ({
    id: r.id,
    userId: r.userId,
    reelId: r.reelId,
    thumbs: r.thumbs,
    favorited: toBool(r.favorited),
    createdAt: toDate(r.createdAt)!,
    updatedAt: toDate(r.updatedAt)!,
  }),
  UserProgress: (r) => ({
    id: r.id,
    userId: r.userId,
    reelId: r.reelId,
    status: r.status,
    bloomLevelAchieved: r.bloomLevelAchieved,
    score: r.score,
    attemptsCount: r.attemptsCount,
    answers: r.answers,
    completedAt: toDate(r.completedAt),
    createdAt: toDate(r.createdAt)!,
  }),
  UserBloomLevel: (r) => ({
    ...r,
    updatedAt: toDate(r.updatedAt)!,
  }),
  SpacedReview: (r) => ({
    id: r.id,
    userId: r.userId,
    reelId: r.reelId,
    nextReviewAt: toDate(r.nextReviewAt)!,
    intervalDays: r.intervalDays,
    repetitionCount: r.repetitionCount,
    easeFactor: r.easeFactor,
    lastReviewedAt: toDate(r.lastReviewedAt),
    createdAt: toDate(r.createdAt)!,
  }),
  Conversation: (r) => ({
    ...r,
    createdAt: toDate(r.createdAt)!,
    updatedAt: toDate(r.updatedAt)!,
  }),
  ContentReport: (r) => ({
    ...r,
    reviewedAt: toDate(r.reviewedAt),
    resolvedAt: toDate(r.resolvedAt),
    resolutionReadAt: toDate(r.resolutionReadAt),
    createdAt: toDate(r.createdAt)!,
  }),
  AdminAction: (r) => ({
    ...r,
    createdAt: toDate(r.createdAt)!,
  }),
  Comm: (r) => ({
    ...r,
    active: toBool(r.active),
    createdAt: toDate(r.createdAt)!,
  }),
  CommUserState: (r) => ({
    ...r,
    updatedAt: toDate(r.updatedAt)!,
  }),
  PasswordResetToken: (r) => ({
    ...r,
    expiresAt: toDate(r.expiresAt)!,
    createdAt: toDate(r.createdAt)!,
    usedAt: toDate(r.usedAt),
  }),
};

function passThrough(r: any, except: string[]) {
  const out: any = {};
  for (const [k, v] of Object.entries(r)) {
    if (except.includes(k)) continue;
    out[k] = v;
  }
  return out;
}

// ── FK-safe migration order ────────────────────────────────
// Each entry: [SQLite table, Prisma client model name]
const ORDER: Array<[string, keyof PrismaClient]> = [
  ["User", "user"],
  ["Topic", "topic"],
  ["LearningReel", "learningReel"],
  ["ReelSource", "reelSource"],
  ["ReelCard", "reelCard"],
  ["CoachConversation", "coachConversation"],
  ["UserReaction", "userReaction"],
  ["UserProgress", "userProgress"],
  ["UserBloomLevel", "userBloomLevel"],
  ["SpacedReview", "spacedReview"],
  ["Conversation", "conversation"],
  ["ContentReport", "contentReport"],
  ["AdminAction", "adminAction"],
  ["Comm", "comm"],
  ["CommUserState", "commUserState"],
  ["PasswordResetToken", "passwordResetToken"],
];

const BATCH_SIZE = 500;

// ── Main ───────────────────────────────────────────────────
function parseArgs() {
  const a = process.argv.slice(2);
  return {
    dryRun: a.includes("--dry-run"),
    force: a.includes("--force"),
    table: a.includes("--table") ? a[a.indexOf("--table") + 1] : undefined,
  };
}

async function migrateTable(sqliteName: string, modelName: keyof PrismaClient) {
  const transform = transformers[sqliteName];
  if (!transform) {
    console.log(`  skip ${sqliteName}: no transformer`);
    return { read: 0, written: 0 };
  }

  const rows = sqlite.prepare(`SELECT * FROM "${sqliteName}"`).all() as any[];
  if (rows.length === 0) {
    console.log(`  ${sqliteName}: 0 rows, skipping`);
    return { read: 0, written: 0 };
  }

  const transformed = rows.map(transform);

  // Batch insert using createMany
  const delegate = (prisma as any)[modelName];
  let written = 0;
  for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
    const chunk = transformed.slice(i, i + BATCH_SIZE);
    const res = await delegate.createMany({ data: chunk, skipDuplicates: true });
    written += res.count;
  }
  return { read: rows.length, written };
}

async function main() {
  const { dryRun, force, table } = parseArgs();

  const filter = table ? [table] : null;
  const plan = filter
    ? ORDER.filter(([name]) => filter.includes(name))
    : ORDER;

  console.log(
    `Migration plan: ${plan.map(([n]) => n).join(" \u2192 ")}${dryRun ? " (DRY RUN)" : ""}`
  );

  // Pre-flight: make sure Neon is empty in every target table.
  if (!force && !dryRun) {
    console.log("\nPre-flight: checking Neon target tables are empty\u2026");
    for (const [sqliteName, modelName] of plan) {
      const delegate = (prisma as any)[modelName];
      const count = await delegate.count();
      if (count > 0) {
        console.error(
          `ABORT: ${sqliteName} already has ${count} rows in Neon. Pass --force to migrate anyway (will use skipDuplicates).`
        );
        await prisma.$disconnect();
        process.exit(1);
      }
    }
    console.log("  all empty \u2713");
  }

  if (dryRun) {
    console.log("\nDry run: source counts");
    for (const [sqliteName] of plan) {
      const c = sqlite.prepare(`SELECT COUNT(*) AS c FROM "${sqliteName}"`).get() as any;
      console.log(`  ${sqliteName}: ${c.c}`);
    }
    await prisma.$disconnect();
    return;
  }

  console.log("\nMigrating\u2026");
  const totals: Record<string, { read: number; written: number }> = {};
  for (const [sqliteName, modelName] of plan) {
    const t0 = Date.now();
    process.stdout.write(`  ${sqliteName} \u2026 `);
    try {
      const { read, written } = await migrateTable(sqliteName, modelName);
      totals[sqliteName] = { read, written };
      const ms = Date.now() - t0;
      console.log(`${written}/${read} in ${ms}ms`);
    } catch (e) {
      console.log(`FAILED: ${(e as Error).message}`);
      totals[sqliteName] = { read: -1, written: -1 };
    }
  }

  console.log("\nTotals:");
  for (const [name, { read, written }] of Object.entries(totals)) {
    console.log(`  ${name}: ${written}/${read}`);
  }

  await prisma.$disconnect();
  sqlite.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
