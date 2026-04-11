import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { startBulkJob, getBulkJob } from "@/lib/bulk-generate";
import type { BloomsLevel } from "@/types/course";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

const ALLOWED_BLOOM: BloomsLevel[] = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
];

export async function POST(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    topicId?: string;
    bloomLevel?: string;
    targetDepartments?: unknown;
    count?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.topicId || typeof body.topicId !== "string") {
    return NextResponse.json({ error: "topicId required" }, { status: 400 });
  }
  if (!body.bloomLevel || !ALLOWED_BLOOM.includes(body.bloomLevel as BloomsLevel)) {
    return NextResponse.json({ error: "bloomLevel required" }, { status: 400 });
  }

  const targetDepartments = Array.isArray(body.targetDepartments)
    ? body.targetDepartments.filter((d): d is string => typeof d === "string")
    : [];

  const count = Math.max(1, Math.min(15, Number(body.count) || 10));

  try {
    const job = await startBulkJob({
      topicId: body.topicId,
      bloomLevel: body.bloomLevel as BloomsLevel,
      targetDepartments,
      count,
      adminId: me.id,
      adminName: me.name,
    });
    return NextResponse.json({ jobId: job.id });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Failed to start bulk job" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = getBulkJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    phase: job.phase,
    message: job.message,
    topicLabel: job.topicLabel,
    count: job.count,
    items: job.items,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}
