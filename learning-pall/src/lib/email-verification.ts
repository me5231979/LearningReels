import crypto from "crypto";
import { prisma } from "./db";
import { sendEmail, buildVerifyEmail } from "./email";

/**
 * Email verification for self-serve @vanderbilt.edu signups.
 *
 * Tokens reuse the PasswordResetToken table (random, stored as sha256,
 * single use). Following either a verification link or a password-reset
 * link proves the person controls the inbox, so both activate the account.
 */

export const VERIFY_TTL_HOURS = 24;

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function sendVerificationEmail(
  user: { id: string; email: string; name: string },
  origin: string
) {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + VERIFY_TTL_HOURS * 60 * 60 * 1000),
    },
  });

  await sendEmail(
    buildVerifyEmail({
      to: user.email,
      name: user.name,
      verifyUrl: `${origin}/api/auth/verify-email?token=${token}`,
      expiresInHours: VERIFY_TTL_HOURS,
    })
  );
}
