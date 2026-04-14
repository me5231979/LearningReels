/**
 * Bulk reel generation: given a topic + audience, use Claude with the
 * web_search tool to discover the most relevant recent articles, dedupe
 * against existing reels in the same topic, and generate N draft reels
 * (one per article) for admin review.
 *
 * Job state is persisted to the BackgroundJob table so it survives
 * function recycling on Vercel and navigation away from the page.
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

export type BulkJobData = {
  topicId: string;
  topicLabel: string;
  targetDepartments: string[];
  count: number;
  bloomLevel: BloomsLevel;
  adminId: string;
  adminName: string;
  topicDescription: string;
};

export type BulkJobView = {
  id: string;
  phase: BulkJobPhase;
  message: string;
  topicLabel: string;
  count: number;
  items: BulkJobItem[];
  error?: string;
  createdAt: string;
  updatedAt: string;
};

// ─── DB helpers ────────────────────────────────────────────

async function saveJob(
  id: string,
  patch: {
    phase?: string;
    status?: string;
    message?: string;
    items?: BulkJobItem[];
    error?: string;
  }
) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.phase !== undefined) updateData.phase = patch.phase;
  if (patch.status !== undefined) updateData.status = patch.status;
  if (patch.message !== undefined) updateData.message = patch.message;
  if (patch.items !== undefined) updateData.items = JSON.stringify(patch.items);
  if (patch.error !== undefined) updateData.error = patch.error;

  await prisma.backgroundJob.update({ where: { id }, data: updateData });
}

export async function getBulkJob(id: string): Promise<BulkJobView | null> {
  const row = await prisma.backgroundJob.findUnique({ where: { id } });
  if (!row || row.type !== "bulk_generate") return null;

  const data = JSON.parse(row.data) as BulkJobData;
  const items = JSON.parse(row.items) as BulkJobItem[];

  return {
    id: row.id,
    phase: row.phase as BulkJobPhase,
    message: row.message,
    topicLabel: data.topicLabel,
    count: data.count,
    items,
    error: row.error ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Get the most recent running or recently-finished bulk job for an admin. */
export async function getLatestBulkJob(adminId: string): Promise<BulkJobView | null> {
  const row = await prisma.backgroundJob.findFirst({
    where: { createdById: adminId, type: "bulk_generate" },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;

  const data = JSON.parse(row.data) as BulkJobData;
  const items = JSON.parse(row.items) as BulkJobItem[];

  return {
    id: row.id,
    phase: row.phase as BulkJobPhase,
    message: row.message,
    topicLabel: data.topicLabel,
    count: data.count,
    items,
    error: row.error ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── URL normalization & dedupe helpers ────────────────────

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

// ─── Discovery via Claude web_search ───────────────────────

async function discoverCandidates(
  topicLabel: string,
  topicDescription: string,
  targetDepartments: string[],
  count: number
): Promise<Candidate[]> {
  const client = getAnthropicClient();

  const audienceLine =
    targetDepartments.length > 0
      ? `Audience: Vanderbilt University staff in these departments — ${targetDepartments.join(", ")}.`
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

// ─── Public API ────────────────────────────────────────────

export type StartBulkJobInput = {
  topicId: string;
  bloomLevel: BloomsLevel;
  targetDepartments: string[];
  count: number;
  adminId: string;
  adminName: string;
};

export async function startBulkJob(input: StartBulkJobInput): Promise<{ jobId: string }> {
  const topic = await prisma.topic.findUnique({ where: { id: input.topicId } });
  if (!topic) throw new Error("Topic not found");

  const id = randomUUID();
  const jobData: BulkJobData = {
    topicId: topic.id,
    topicLabel: topic.label,
    targetDepartments: input.targetDepartments,
    count: input.count,
    bloomLevel: input.bloomLevel,
    adminId: input.adminId,
    adminName: input.adminName,
    topicDescription: topic.description,
  };

  await prisma.backgroundJob.create({
    data: {
      id,
      type: "bulk_generate",
      status: "running",
      phase: "queued",
      message: "Job queued",
      data: JSON.stringify(jobData),
      items: "[]",
      createdById: input.adminId,
    },
  });

  // Fire-and-forget — the job saves its own progress to the DB.
  void runBulkJob(id, jobData);

  return { jobId: id };
}

// ─── Background runner ─────────────────────────────────────

async function runBulkJob(jobId: string, jobData: BulkJobData) {
  try {
    // 1. Discovery
    await saveJob(jobId, {
      phase: "discovering",
      message: "Searching the web for relevant articles…",
    });
    const candidates = await discoverCandidates(
      jobData.topicLabel,
      jobData.topicDescription,
      jobData.targetDepartments,
      jobData.count
    );
    if (candidates.length === 0) {
      await saveJob(jobId, {
        phase: "failed",
        status: "failed",
        message: "Web search did not return any usable candidates.",
        error: "no_candidates",
      });
      return;
    }

    // 2. Dedupe
    await saveJob(jobId, {
      phase: "deduping",
      message: `Found ${candidates.length} candidates. Removing duplicates…`,
    });
    const dedupe = await buildDedupeIndex(jobData.topicId);
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
    await saveJob(jobId, { items });

    // 3. Generate reels one-by-one, saving progress after each
    await saveJob(jobId, {
      phase: "generating",
      message: "Generating reels…",
      items,
    });
    let made = 0;
    for (let i = 0; i < items.length && made < jobData.count; i++) {
      const item = items[i];
      if (item.status !== "pending") continue;

      // Scrape
      item.status = "scraping";
      await saveJob(jobId, {
        message: `Scraping (${made + 1}/${jobData.count}): ${item.title.slice(0, 60)}`,
        items,
      });

      let ingest;
      try {
        ingest = await ingestUrl(item.url);
      } catch (e) {
        item.status = "failed";
        item.error = `Scrape failed: ${(e as Error).message}`;
        await saveJob(jobId, { items });
        continue;
      }
      if (!ingest.text || ingest.text.length < 400) {
        item.status = "failed";
        item.error = "Page text too short (likely paywalled)";
        await saveJob(jobId, { items });
        continue;
      }

      // Generate reel
      item.status = "generating";
      await saveJob(jobId, {
        message: `Generating reel (${made + 1}/${jobData.count}): ${item.title.slice(0, 60)}`,
        items,
      });

      try {
        const result = await generateReelFromSource({
          topicId: jobData.topicId,
          bloomLevel: jobData.bloomLevel,
          body: ingest.text,
          titleHint: item.title || ingest.title,
          sourceType: "url",
          sourceLabel: item.url,
          generatedById: jobData.adminId,
          generatedByName: jobData.adminName,
          snapshotPdfBuffer: ingest.pdfBuffer ?? undefined,
          originalUrl: item.url,
          targetDepartments: jobData.targetDepartments,
        });
        item.status = "done";
        item.reelId = result.reelId;
        item.reelTitle = result.title;
        made++;
      } catch (e) {
        item.status = "failed";
        item.error = `Generate failed: ${(e as Error).message}`;
      }
      // Save after every reel — progress persists even if function dies
      await saveJob(jobId, { items });
    }

    await saveJob(jobId, {
      phase: "done",
      status: "done",
      message: `Created ${made} draft reel${made === 1 ? "" : "s"}. Review and publish in the Reels Library.`,
      items,
    });
  } catch (e) {
    await saveJob(jobId, {
      phase: "failed",
      status: "failed",
      message: `Bulk job failed: ${(e as Error).message}`,
      error: (e as Error).message,
    }).catch(() => {}); // don't throw from error handler
  }
}
