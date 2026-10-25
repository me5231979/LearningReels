import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSession, setSessionCookie, type Role } from "@/lib/auth";
import { hashToken } from "@/lib/email-verification";

// GET /api/auth/verify-email?token=… — the link in the verification email.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const loginUrl = new URL("/login", request.url);

  if (!token) return NextResponse.redirect(loginUrl);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (
    !record ||
    record.usedAt ||
    record.expiresAt < new Date() ||
    record.user.deletedAt ||
    record.user.status !== "pending_verification"
  ) {
    loginUrl.searchParams.set("verify", "invalid");
    return NextResponse.redirect(loginUrl);
  }

  const user = record.user;
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { status: "active" } }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  const session = await signSession({
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
  });
  await setSessionCookie(session);

  return NextResponse.redirect(new URL("/onboarding", request.url));
}
