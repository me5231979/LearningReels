/**
 * QA pass: deduplicate published reels.
 *
 * Strategy:
 *  1) Exact-title dupes within a category → keep oldest, delete the rest.
 *  2) "Concept" dupes within a category → group by a normalized concept key
 *     (lowercased, common stopwords + punctuation stripped, tokens sorted),
 *     keep oldest of each concept group, delete the rest.
 *  3) Cards / progress / reactions / spaced reviews cascade-delete via FK.
 */
import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "data", "learning-pall.db"));

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "for",
  "to",
  "in",
  "on",
  "with",
  "your",
  "you",
  "is",
  "that",
  "it",
  "its",
  "this",
  "be",
  "as",
  "by",
  "from",
  "at",
  "or",
  "but",
  "into",
  "about",
  "how",
  "what",
  "why",
  "when",
  "where",
  "method",
  "framework",
  "approach",
  "technique",
  "process",
  "system",
  "model",
  "way",
  "ways",
  "guide",
  "tips",
  "tip",
  "step",
  "steps",
  "rule",
  "rules",
  "really",
  "actually",
  "truly",
  "works",
  "work",
  "mastery",
  "master",
  "pro",
  "like",
  "use",
  "using",
  "make",
  "making",
  "execute",
  "judge",
  "build",
  "building",
  "create",
  "creating",
  "lead",
  "leading",
  "manage",
  "managing",
]);

function conceptKey(title: string): string {
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t && !STOPWORDS.has(t) && t.length > 1);
  // sort + dedupe so word order doesn't matter
  return Array.from(new Set(tokens)).sort().join(" ");
}

type Row = {
  id: string;
  title: string;
  category: string;
  createdAt: string;
};

const rows = db
  .prepare(
    `SELECT r.id, r.title, t.category, r.createdAt
     FROM LearningReel r
     JOIN Topic t ON t.id = r.topicId
     WHERE r.status = 'published'`
  )
  .all() as Row[];

console.log(`Loaded ${rows.length} published reels`);

// Bucket by category + concept key
const buckets = new Map<string, Row[]>();
for (const r of rows) {
  const key = `${r.category}::${conceptKey(r.title)}`;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key)!.push(r);
}

const toDelete: { id: string; title: string; category: string }[] = [];
for (const [key, group] of buckets) {
  if (group.length <= 1) continue;
  // Keep oldest
  group.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const keep = group[0];
  for (const r of group.slice(1)) {
    toDelete.push({ id: r.id, title: r.title, category: r.category });
  }
  console.log(
    `[${key}] kept "${keep.title}" — deleting ${group.length - 1} dupes`
  );
}

console.log(`\nTotal to delete: ${toDelete.length}`);

const dryRun = process.argv.includes("--dry");
if (dryRun) {
  console.log("DRY RUN — no deletions");
  process.exit(0);
}

const deleteStmt = db.prepare("DELETE FROM LearningReel WHERE id = ?");
const tx = db.transaction((items: typeof toDelete) => {
  for (const it of items) deleteStmt.run(it.id);
});
tx(toDelete);

const after = db
  .prepare("SELECT COUNT(*) as c FROM LearningReel WHERE status = 'published'")
  .get() as { c: number };
console.log(`\nDone. Published reels now: ${after.c}`);
db.close();
