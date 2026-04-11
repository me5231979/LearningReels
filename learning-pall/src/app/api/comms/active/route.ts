import { NextResponse } from "next/server";
import { readSessionWithIat } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVisibleToUser, parseTargetDepartments } from "@/lib/departments";

const MAX_VIEWS_PER_USER = 3;

/**
 * Returns the currently active comm for the learner if they should still see
 * it. Each call counts as one impression IFF the JWT iat differs from the
 * iat that was last recorded — i.e. one increment per fresh login session,
 * not per page reload. Stops returning the comm after 3 sessions.
 */
export async function GET() {
  const session = await readSessionWithIat();
  if (!session) {
    return NextResponse.json({ comm: null });
  }

  const comm = await prisma.comm.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });
  if (!comm) return NextResponse.json({ comm: null });

  // Filter out comms the current user can't see based on department targeting
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { department: true },
  });
  const targets = parseTargetDepartments(comm.targetDepartments);
  if (!isVisibleToUser(targets, user?.department ?? null)) {
    return NextResponse.json({ comm: null });
  }

  // Find or create the per-user state for this comm
  let state = await prisma.commUserState.findUnique({
    where: { commId_userId: { commId: comm.id, userId: session.uid } },
  });

  if (!state) {
    state = await prisma.commUserState.create({
      data: {
        commId: comm.id,
        userId: session.uid,
        viewCount: 1,
        lastSessionIat: session.iat,
      },
    });
  } else if (state.lastSessionIat !== session.iat) {
    // New login session — count as another impression if under the cap
    if (state.viewCount < MAX_VIEWS_PER_USER) {
      state = await prisma.commUserState.update({
        where: { id: state.id },
        data: {
          viewCount: { increment: 1 },
          lastSessionIat: session.iat,
        },
      });
    } else {
      // Already capped; just update iat so we don't keep checking
      state = await prisma.commUserState.update({
        where: { id: state.id },
        data: { lastSessionIat: session.iat },
      });
    }
  }

  if (state.viewCount > MAX_VIEWS_PER_USER) {
    return NextResponse.json({ comm: null });
  }

  return NextResponse.json({
    comm: {
      id: comm.id,
      heading: comm.heading,
      details: comm.details,
      ctaText: comm.ctaText,
      ctaUrl: comm.ctaUrl,
    },
    viewNumber: state.viewCount,
  });
}
