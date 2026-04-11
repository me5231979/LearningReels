/**
 * Email sending stub.
 *
 * In production this should be wired to a real provider (Resend, SendGrid,
 * Postmark, etc.). For now we log to the server console so password reset
 * links are visible during development.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(message: EmailMessage): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("\n──────── EMAIL (dev) ────────");
  console.log("To:     ", message.to);
  console.log("Subject:", message.subject);
  console.log("Body:");
  console.log(message.text);
  console.log("─────────────────────────────\n");
}

export function buildPasswordResetEmail(opts: {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): EmailMessage {
  const { to, name, resetUrl, expiresInMinutes } = opts;
  const text = `Hi ${name},

We received a request to reset your Learning Reels password.

Click the link below to choose a new password. This link expires in ${expiresInMinutes} minutes.

${resetUrl}

If you did not request a password reset, you can safely ignore this email.

— Vanderbilt Learning Reels`;

  return {
    to,
    subject: "Reset your Learning Reels password",
    text,
  };
}
