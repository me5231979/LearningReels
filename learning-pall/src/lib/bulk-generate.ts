/**
 * Bulk reel generation: given a topic + audience, use Claude with the
 * web_search tool to discover the most relevant recent articles, dedupe
 * against existing reels in the same topic, and generate N draft reels
 * (one per article) for admin review.
 *
 * Job state lives in module-scope (single-process dev). On a real prod
 * deployment behind multiple workers we would persist this to the DB.
 */
import { randomUUID } from "crypto";
import { prisma } from "./db";
import { getAnthropicClient } from "./claude";
import { ingestUrl } from "./pdf/snapshot";
import { generateReelFromSource } from "./generate-from-source";
import type { BloomsLevel } from "@/types/course";

export type BulkJobItemStatus =
  | "pending"
  | "scraping"
  | "generating"
  | "done"
  | "duplicate"
  | "failed";

export type BulkJobItem = {
  url: string;
  title: string;
  publication: string | null;
  status: BulkJobItemStatus;
  error?: string;
  reelId?: string;
  reelTitle?: string;
};

export type BulkJobPhase =
  | "queued"
  | "discovering"
  | "deduping"
  | "generating"
  | "done"
  | "failed";

export type BulkJob = {
  id: string;
  topicId: string;
  topicLabel: string;
  targetDepartments: string[];
  count: number;
  bloomLevel: BloomsLevel;
  adminId: string;
  adminName: string;
  phase: BulkJobPhase;
  message: string;
  items: BulkJobItem[];
  createdAt: number;
  updatedAt: number;
  error?: string;
};

// Survives Next.js HMR — module-scope state resets on every edit, so we
// pin the jobs map to globalThis. Safe in dev; in prod each worker keeps
// its own copy (acceptable for an MVP admin tool).
const globalForJobs = globalThis as unknown as { __bulkJobs?: Map<string, BulkJob> };
const jobs: Map<string, BulkJob> =
  globalForJobs.__bulkJobs ?? (globalForJobs.__bulkJobs = new Map());

function touch(job: BulkJob, patch: Partial<BulkJob>) {
  Object.assign(job, patch, { updatedAt: Date.now() });
}

export function getBulkJob(id: string): BulkJob | null {
  return jobs.get(id) ?? null;
}

/**
 * Normalize a URL for dedupe: lowercase host, strip trailing slash and
 * tracking params (utm_*, gclid, etc).
 */
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    const drop: string[] = [];
    u.searchParams.forEach((_, key) => {
      if (/^utm_|^gclid$|^fbclid$|^mc_/i.test(key)) drop.push(key);
    });
    drop.forEach((k) => u.searchParams.delete(k));
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

function fuzzyTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6)
    .sort()
    .join(" ");
}

type Candidate = { url: string; title: string; publication: string | null };

// Domains that Anthropic's web_search crawler is permitted to access AND that
// publish substantive practitioner-oriented content. Some otherwise reputable
// publishers (e.g. forbes.com) block Anthropic's user agent and must be excluded.
const REPUTABLE_DOMAINS = [
  "hbr.org",
  "sloanreview.mit.edu",
  "mckinsey.com",
  "bcg.com",
  "bain.com",
  "deloitte.com",
  "kornferry.com",
  "ddiworld.com",
  "ccl.org",
  "gallup.com",
  "fastcompany.com",
  "knowledge.wharton.upenn.edu",
  "stanford.edu",
  "hbswk.hbs.edu",
  "strategy-business.com",
  "strategyand.pwc.com",
  "weforum.org",
  "thinkers50.com",
  "brookings.edu",
  "pmi.org",
  "shrm.org",
  "td.org",
];

/**
 * Ask Claude to use web_search to find N recent, reputable articles for the
 * given topic + audience. Returns a parsed JSON array of candidates.
 */
async function discoverCandidates(
  topicLabel: string,
  topicDescription: string,
  targetDepartments: string[],
  count: number
): Promise<Candidate[]> {
  const client = getAnthropicClient();

  const audienceLine =
    targetDepartments.length > 0
      ? `Audience: Vanderbilt University staff in these departments — ${targetDepartments.join(
          ", "
        )}.`
      : "Audience: All Vanderbilt University staff.";

  const userPrompt = `You are a Vanderbilt University learning content scout. Use web_search to find ${
    count + 5
  } of the most relevant, recent (2023-2026), and substantive online articles on this topic so they can be turned into Learning Reels for working professionals.

TOPIC: "${topicLabel}"
CONTEXT: ${topicDescription}
${audienceLine}

REQUIREMENTS:
- Each article must be from a reputable publication: HBR, MIT Sloan Management Review, McKinsey, BCG, Bain, Deloitte, Korn Ferry, DDI, CCL, Gallup, Wharton, Stanford, HBS Working Knowledge, Fast Company, World Economic Forum, PMI, SHRM, ATD, or named expert blogs from recognized authors.
- Prefer articles published in the last 24 months. Include the publication date if you can find it.
- Each article must be a real, full-length editorial piece — NOT a paywalled landing page, listicle aggregator, blog index, marketing brochure, podcast page, or generic "what is X" definition.
- Skip duplicates: only one article per distinct concept or framework.
- Skip anything about DEI, health treatment, dangerous activities, alcohol/drugs, or deep abstract theory.
- Prefer practical, professional skill articles a working manager or staff member could apply on the job.

After completing your searches, return ONLY a single JSON object — no prose, no markdown — in this exact shape:

{
  "candidates": [
    { "url": "https://...", "title": "Article title", "publication": "Publication name", "publishedAt": "2024-05" | null }
  ]
}

Return at least ${count} candidates if you can find enough quality matches. The URLs must be the canonical article URLs you found from search results — do not invent URLs.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 6,
        allowed_domains: REPUTABLE_DOMAINS,
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  // Find the final text block — that's where the JSON lives.
  const textBlocks = response.content.filter(
    (b): b is Extract<typeof b, { type: "text" }> => b.type === "text"
  );
  const finalText = textBlocks.map((b) => b.text).join("\n");
  const jsonMatch = finalText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  let parsed: { candidates?: Array<{ url?: string; title?: string; publication?: string }> };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  const out: Candidate[] = [];
  for (const c of parsed.candidates || []) {
    if (typeof c.url !== "string" || typeof c.title !== "string") continue;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(c.url);
    } catch {
      continue;
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) continue;
    out.push({
      url: c.url,
      title: c.title,
      publication: typeof c.publication === "string" ? c.publication : null,
    });
  }
  return out;
}

/**
 * Returns a Set of normalized URL keys + a Set of fuzzy title keys for all
 * existing reels in the given topic. Used to dedupe new candidates.
 */
async function buildDedupeIndex(
  topicId: string
): Promise<{ urls: Set<string>; titles: Set<string> }> {
  const existing = await prisma.learningReel.findMany({
    where: { topicId },
    select: { title: true, sourceUrl: true },
  });
  const urls = new Set<string>();
  const titles = new Set<string>();
  for (const r of existing) {
    if (r.sourceUrl) urls.add(normalizeUrl(r.sourceUrl));
    if (r.title) titles.add(fuzzyTitleKey(r.title));
  }
  return { urls, titles };
}

export type StartBulkJobInput = {
  topicId: string;
  bloomLevel: BloomsLevel;
  targetDepartments: string[];
  count: number;
  adminId: string;
  adminName: string;
};

export async function startBulkJob(input: StartBulkJobInput): Promise<BulkJob> {
  const topic = await prisma.topic.findUnique({ where: { id: input.topicId } });
  if (!topic) throw new Error("Topic not found");

  const id = randomUUID();
  const now = Date.now();
  const job: BulkJob = {
    id,
    topicId: topic.id,
    topicLabel: topic.label,
    targetDepartments: input.targetDepartments,
    count: input.count,
    bloomLevel: input.bloomLevel,
    adminId: input.adminId,
    adminName: input.adminName,
    phase: "queued",
    message: "Job queued",
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, job);

  // Fire-and-forget background runner.
  void runBulkJob(job, topic.description);

  return job;
}

async function runBulkJob(job: BulkJob, topicDescription: string) {
  try {
    // 1. Discovery
    touch(job, { phase: "discovering", message: "Searching the web for relevant articles…" });
    const candidates = await discoverCandidates(
      job.topicLabel,
      topicDescription,
      job.targetDepartments,
      job.count
    );
    if (candidates.length === 0) {
      touch(job, {
        phase: "failed",
        message: "Web search did not return any usable candidates.",
        error: "no_candidates",
      });
      return;
    }

    // 2. Dedupe
    touch(job, {
      phase: "deduping",
      message: `Found ${candidates.length} candidates. Removing duplicates…`,
    });
    const dedupe = await buildDedupeIndex(job.topicId);
    const seenInJobUrls = new Set<string>();
    const seenInJobTitles = new Set<string>();
    const items: BulkJobItem[] = [];
    for (const c of candidates) {
      const normUrl = normalizeUrl(c.url);
      const titleKey = fuzzyTitleKey(c.title);
      const isDup =
        dedupe.urls.has(normUrl) ||
        dedupe.titles.has(titleKey) ||
        seenInJobUrls.has(normUrl) ||
        seenInJobTitles.has(titleKey);
      items.push({
        url: c.url,
        title: c.title,
        publication: c.publication,
        status: isDup ? "duplicate" : "pending",
      });
      if (!isDup) {
        seenInJobUrls.add(normUrl);
        seenInJobTitles.add(titleKey);
      }
    }
    touch(job, { items });

    // 3. Generate (sequential — puppeteer + Claude is heavy)
    touch(job, { phase: "generating", message: "Generating reels…" });
    let made = 0;
    for (let i = 0; i < items.length && made < job.count; i++) {
      const item = items[i];
      if (item.status !== "pending") continue;

      // mark scraping
      item.status = "scraping";
      touch(job, {
        message: `Scraping (${made + 1}/${job.count}): ${item.title.slice(0, 60)}`,
      });

      let ingest;
      try {
        ingest = await ingestUrl(item.url);
      } catch (e) {
        item.status = "failed";
        item.error = `Scrape failed: ${(e as Error).message}`;
        touch(job, {});
        continue;
      }
      if (!ingest.text || ingest.text.length < 400) {
        item.status = "failed";
        item.error = "Page text too short (likely paywalled)";
        touch(job, {});
        continue;
      }

      // mark generating
      item.status = "generating";
      touch(job, {
        message: `Generating reel (${made + 1}/${job.count}): ${item.title.slice(0, 60)}`,
      });

      try {
        const result = await generateReelFromSource({
          topicId: job.topicId,
          bloomLevel: job.bloomLevel,
          body: ingest.text,
          titleHint: item.title || ingest.title,
          sourceType: "url",
          sourceLabel: item.url,
          generatedById: job.adminId,
          generatedByName: job.adminName,
          snapshotPdfBuffer: ingest.pdfBuffer,
          originalUrl: item.url,
          targetDepartments: job.targetDepartments,
        });
        item.status = "done";
        item.reelId = result.reelId;
        item.reelTitle = result.title;
        made++;
      } catch (e) {
        item.status = "failed";
        item.error = `Generate failed: ${(e as Error).message}`;
      }
      touch(job, {});
    }

    touch(job, {
      phase: "done",
      message: `Created ${made} draft reel${made === 1 ? "" : "s"}. Review and publish in the Reels Library.`,
    });
  } catch (e) {
    touch(job, {
      phase: "failed",
      message: `Bulk job failed: ${(e as Error).message}`,
      error: (e as Error).message,
    });
  }
}
