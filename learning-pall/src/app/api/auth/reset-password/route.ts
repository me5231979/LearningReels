import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.token !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { error: "Token and password required" },
      { status: 400 }
    );
  }

  if (body.password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const tokenHash = hashToken(body.token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(body.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate any other outstanding tokens for the same user.
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null, NOT: { id: record.id } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

// GET — verify token validity (used by the reset page on load)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  const valid = !!record && !record.usedAt && record.expiresAt >= new Date();
  return NextResponse.json({ valid });
}
