import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail, buildPasswordResetEmail } from "@/lib/email";

const TOKEN_TTL_MINUTES = 30;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();

  // Look up user — but always respond with the same generic message so
  // that the endpoint cannot be used to enumerate registered emails.
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.deletedAt && user.status !== "denied") {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    // Invalidate any prior unused tokens for this user.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const origin =
      request.nextUrl.origin || process.env.APP_URL || "http://localhost:3000";
    const resetUrl = `${origin}/reset-password?token=${token}`;

    await sendEmail(
      buildPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresInMinutes: TOKEN_TTL_MINUTES,
      })
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "If an account exists for that email, a password reset link is on its way.",
  });
}
