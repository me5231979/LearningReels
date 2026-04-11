import { requireAdmin, isSuperAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Database from "better-sqlite3";
import { existsSync } from "fs";
import path from "path";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

function getRawDb() {
  const candidates = [
    path.join(process.cwd(), "data", "learning-pall.db"),
    path.join(process.cwd(), "learning-pall", "data", "learning-pall.db"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return new Database(p);
  }
  return new Database("/Users/estesm4/Desktop/Learning Pall/learning-pall/data/learning-pall.db");
}

export default async function ReportsPage() {
  const me = await requireAdmin();
  if (!me) return null;

  if (!isSuperAdminRole(me.role)) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-condensed uppercase tracking-wider text-vand-sand">Reports</h1>
        <p className="text-sm text-vand-sand/60 mt-3">
          Content reports and learner reactions are visible to the super admin only.
        </p>
      </div>
    );
  }

  const [reports, thumbs] = await Promise.all([
    prisma.contentReport.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true } },
        reel: { select: { id: true, title: true, topic: { select: { label: true } } } },
      },
    }),
    prisma.userReaction.findMany({
      where: { thumbs: "down" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
        reel: { select: { id: true, title: true, topic: { select: { label: true } } } },
      },
    }),
  ]);

  // Fetch resolution metadata via raw SQL — Prisma client cache may not know
  // the new columns yet in dev.
  type ResolutionRow = {
    id: string;
    resolution: string | null;
    resolvedAt: string | null;
    resolvedById: string | null;
    resolverName: string | null;
  };
  const resolutionMap = new Map<string, ResolutionRow>();
  if (reports.length > 0) {
    try {
      const db = getRawDb();
      const placeholders = reports.map(() => "?").join(",");
      const rows = db
        .prepare(
          `SELECT r.id, r.resolution, r.resolvedAt, r.resolvedById, u.name as resolverName
           FROM ContentReport r
           LEFT JOIN User u ON u.id = r.resolvedById
           WHERE r.id IN (${placeholders})`
        )
        .all(...reports.map((r) => r.id)) as ResolutionRow[];
      for (const row of rows) resolutionMap.set(row.id, row);
      db.close();
    } catch (e) {
      console.error("Failed to fetch report resolutions:", e);
    }
  }

  return (
    <ReportsClient
      reports={reports.map((r) => {
        const res = resolutionMap.get(r.id);
        return {
          id: r.id,
          reason: r.reason,
          details: r.details,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          user: r.user,
          reel: { id: r.reel.id, title: r.reel.title, topic: r.reel.topic.label },
          resolution: res?.resolution ?? null,
          resolvedAt: res?.resolvedAt ?? null,
          resolverName: res?.resolverName ?? null,
        };
      })}
      thumbs={thumbs.map((t) => ({
        id: t.id,
        updatedAt: t.updatedAt.toISOString(),
        user: t.user,
        reel: { id: t.reel.id, title: t.reel.title, topic: t.reel.topic.label },
      }))}
    />
  );
}
