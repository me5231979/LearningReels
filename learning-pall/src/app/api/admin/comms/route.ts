import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  parseTargetDepartments,
  serializeTargetDepartments,
} from "@/lib/departments";

export async function GET() {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const comms = await prisma.comm.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      states: {
        select: {
          viewCount: true,
          dismissedCount: true,
          ctaClickedCount: true,
        },
      },
    },
  });

  const list = comms.map((c) => {
    const usersReached = c.states.length;
    const totalImpressions = c.states.reduce((s, x) => s + x.viewCount, 0);
    const totalDismissals = c.states.reduce((s, x) => s + x.dismissedCount, 0);
    const totalCtaClicks = c.states.reduce((s, x) => s + x.ctaClickedCount, 0);
    return {
      id: c.id,
      heading: c.heading,
      details: c.details,
      ctaText: c.ctaText,
      ctaUrl: c.ctaUrl,
      active: c.active,
      targetDepartments: parseTargetDepartments(c.targetDepartments),
      createdAt: c.createdAt,
      stats: {
        usersReached,
        totalImpressions,
        totalDismissals,
        totalCtaClicks,
      },
    };
  });

  return NextResponse.json({ comms: list });
}

export async function POST(request: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const heading = typeof body.heading === "string" ? body.heading.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  const ctaText =
    typeof body.ctaText === "string" && body.ctaText.trim()
      ? body.ctaText.trim()
      : null;
  const ctaUrl =
    typeof body.ctaUrl === "string" && body.ctaUrl.trim()
      ? body.ctaUrl.trim()
      : null;
  const active = body.active !== false;
  const targetDepartments = Array.isArray(body.targetDepartments)
    ? serializeTargetDepartments(
        body.targetDepartments.filter((d: unknown): d is string => typeof d === "string")
      )
    : null;

  if (!heading || !details) {
    return NextResponse.json(
      { error: "Heading and details are required" },
      { status: 400 }
    );
  }
  if ((ctaText && !ctaUrl) || (ctaUrl && !ctaText)) {
    return NextResponse.json(
      { error: "CTA text and link must both be provided together" },
      { status: 400 }
    );
  }

  // Only one active comm at a time — deactivate others when activating this one
  const comm = await prisma.$transaction(async (tx) => {
    if (active) {
      await tx.comm.updateMany({ where: { active: true }, data: { active: false } });
    }
    return tx.comm.create({
      data: {
        heading,
        details,
        ctaText,
        ctaUrl,
        active,
        targetDepartments,
        createdById: me.id,
      },
    });
  });

  await prisma.adminAction.create({
    data: {
      actorId: me.id,
      action: "comm.create",
      targetType: "comm",
      targetId: comm.id,
      metadata: JSON.stringify({ heading, active }),
    },
  });

  return NextResponse.json({ comm });
}
