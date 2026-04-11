/**
 * Archive (not delete) near-duplicate published reels using Jaccard similarity.
 *
 * For each cluster, keeps ONE reel as winner — the rest are set to status='archived'
 * so they remain recoverable in the admin Reels Library but no longer surface in
 * the learner feed.
 *
 * Winner selection (per cluster):
 *  1. Highest engagement (completed UserProgress + thumbs-up reactions)
 *  2. Longest descriptive title
 *  3. Oldest createdAt
 *
 * Special case: SBI Feedback clusters prefer the canonical title
 *   "The SBI Feedback Model: Making Every Conversation Count"
 * because the user explicitly asked to keep that one.
 *
 * Run with `--dry` for a preview without writing.
 */
import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "data", "learning-pall.db"));

const STOPWORDS = new Set([
  "the","a","an","of","and","for","to","in","on","with","your","you","is",
  "that","it","its","this","be","as","by","from","at","or","but","into",
  "about","how","what","why","when","where","method","framework","approach",
  "technique","process","system","model","way","ways","guide","tips","tip",
  "step","steps","rule","rules","really","actually","truly","works","work",
  "mastery","master","pro","like","use","using","make","making","execute",
  "judge","build","building","create","creating","lead","leading","manage",
  "managing","every","get","getting","do","doing","new","one","two","more",
  "most","best","good","great","just","can","will","not","no","yes","than",
  "then","so","up","down","out","off","over","under","again","because",
  "while","each","every","any","all","some","such","only","own","same",
  "before","after","through","during","without","within","across","between",
  "vs","versus","yourself","myself","ourselves","themselves",
]);

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((t) => t && !STOPWORDS.has(t) && t.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): { sim: number; intersect: number } {
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return { sim: union === 0 ? 0 : intersect / union, intersect };
}

type Row = {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  engagement: number;
};

// Pull published reels with engagement scores
const rows = db
  .prepare(
    `SELECT
       r.id,
       r.title,
       t.category,
       r.createdAt,
       (
         (SELECT COUNT(*) FROM UserProgress p WHERE p.reelId = r.id AND p.status = 'completed')
         +
         (SELECT COUNT(*) FROM UserReaction ur WHERE ur.reelId = r.id AND ur.thumbs = 'up')
       ) as engagement
     FROM LearningReel r
     JOIN Topic t ON t.id = r.topicId
     WHERE r.status = 'published'`
  )
  .all() as Row[];

console.log(`Loaded ${rows.length} published reels\n`);

// Group by category, then cluster by Jaccard similarity
const byCategory = new Map<string, Row[]>();
for (const r of rows) {
  if (!byCategory.has(r.category)) byCategory.set(r.category, []);
  byCategory.get(r.category)!.push(r);
}

const SBI_CANONICAL = "The SBI Feedback Model: Making Every Conversation Count".toLowerCase();

type Cluster = { category: string; members: Row[] };
const clusters: Cluster[] = [];

for (const [category, list] of byCategory) {
  const tokenMap = new Map<string, Set<string>>();
  for (const r of list) tokenMap.set(r.id, tokenize(r.title));

  const visited = new Set<string>();
  for (const seed of list) {
    if (visited.has(seed.id)) continue;
    const seedTokens = tokenMap.get(seed.id)!;
    if (seedTokens.size < 2) {
      visited.add(seed.id);
      continue;
    }
    const cluster: Row[] = [seed];
    visited.add(seed.id);
    for (const other of list) {
      if (visited.has(other.id)) continue;
      const otherTokens = tokenMap.get(other.id)!;
      if (otherTokens.size < 2) continue;
      const { sim, intersect } = jaccard(seedTokens, otherTokens);
      if (intersect >= 2 && sim >= 0.4) {
        cluster.push(other);
        visited.add(other.id);
      }
    }
    if (cluster.length > 1) clusters.push({ category, members: cluster });
  }
}

// Pick winner per cluster
type Decision = { keep: Row; archive: Row[]; category: string; reason: string };
const decisions: Decision[] = [];

for (const c of clusters) {
  const isSBI = c.members.some((m) => m.title.toLowerCase().includes("sbi"));
  let keep: Row | undefined;
  let reason = "";

  if (isSBI) {
    keep = c.members.find((m) => m.title.toLowerCase() === SBI_CANONICAL);
    if (keep) reason = "SBI canonical";
  }

  if (!keep) {
    const sorted = [...c.members].sort((a, b) => {
      if (b.engagement !== a.engagement) return b.engagement - a.engagement;
      if (b.title.length !== a.title.length) return b.title.length - a.title.length;
      return a.createdAt.localeCompare(b.createdAt);
    });
    keep = sorted[0];
    reason = keep.engagement > 0 ? `engagement ${keep.engagement}` : "longest title";
  }

  decisions.push({
    keep,
    archive: c.members.filter((m) => m.id !== keep!.id),
    category: c.category,
    reason,
  });
}

// Report by category
const byCat = new Map<string, { clusters: number; archived: number; kept: number }>();
for (const d of decisions) {
  const e = byCat.get(d.category) || { clusters: 0, archived: 0, kept: 0 };
  e.clusters++;
  e.archived += d.archive.length;
  e.kept++;
  byCat.set(d.category, e);
}

console.log("=".repeat(80));
console.log("PER-CATEGORY SUMMARY");
console.log("=".repeat(80));
for (const [cat, stats] of [...byCat.entries()].sort()) {
  console.log(
    `  ${cat.padEnd(28)} ${stats.clusters} clusters · keep ${stats.kept} · archive ${stats.archived}`
  );
}

const totalArchive = decisions.reduce((s, d) => s + d.archive.length, 0);
console.log(`\nTotal clusters: ${decisions.length}`);
console.log(`Total to archive: ${totalArchive}`);
console.log(`Total to keep:    ${decisions.length}`);

// Show a sample of decisions
console.log("\n" + "=".repeat(80));
console.log("SAMPLE CLUSTERS (first 12)");
console.log("=".repeat(80));
for (const d of decisions.slice(0, 12)) {
  console.log(`\n[${d.category}] (${d.reason})`);
  console.log(`  KEEP    "${d.keep.title}" (eng ${d.keep.engagement})`);
  for (const a of d.archive) {
    console.log(`  ARCHIVE "${a.title}" (eng ${a.engagement})`);
  }
}

const dryRun = process.argv.includes("--dry");
if (dryRun) {
  console.log("\nDRY RUN — no changes made.");
  db.close();
  process.exit(0);
}

// Apply
const stmt = db.prepare(
  "UPDATE LearningReel SET status = 'archived', updatedAt = CURRENT_TIMESTAMP WHERE id = ?"
);
const tx = db.transaction((ids: string[]) => {
  for (const id of ids) stmt.run(id);
});
const ids = decisions.flatMap((d) => d.archive.map((r) => r.id));
tx(ids);

const after = db
  .prepare("SELECT status, COUNT(*) as c FROM LearningReel GROUP BY status")
  .all() as { status: string; c: number }[];
console.log("\nFinal status counts:");
for (const row of after) console.log(`  ${row.status}: ${row.c}`);

db.close();
