import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requireSuperAdmin();
  if (!me) return NextResponse.json({ error: "Super admin only" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { status, resolution } = body as { status?: string; resolution?: string };

  if (status && !["open", "reviewed", "dismissed", "actioned"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (status) {
    data.status = status;
    data.reviewedAt = status === "open" ? null : new Date();
  }
  if (typeof resolution === "string") {
    const trimmed = resolution.trim();
    if (trimmed.length === 0) {
      data.resolution = null;
      data.resolvedAt = null;
      data.resolvedById = null;
      data.resolutionReadAt = null;
    } else {
      data.resolution = trimmed;
      data.resolvedAt = new Date();
      data.resolvedById = me.id;
      data.resolutionReadAt = null;
    }
  }
  if (Object.keys(data).length > 0) {
    await prisma.contentReport.update({ where: { id }, data });
  }

  await prisma.adminAction.create({
    data: {
      actorId: me.id,
      action: "report.resolve",
      targetType: "report",
      targetId: id,
      metadata: JSON.stringify({
        status: status ?? null,
        hasResolution: typeof resolution === "string" && resolution.trim().length > 0,
      }),
    },
  });

  return NextResponse.json({ ok: true });
}
