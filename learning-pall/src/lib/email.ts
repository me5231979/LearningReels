/**
 * Email sending.
 *
 * Uses Resend when RESEND_API_KEY is set (production + preview deploys).
 * Falls back to logging the message to the server console when the key
 * is missing, so local dev still surfaces password-reset links without
 * requiring credentials.
 *
 * Environment variables:
 *   RESEND_API_KEY  — Resend API key (required for real sending)
 *   EMAIL_FROM      — From address, e.g. "Vanderbilt Learning Reels <no-reply@your-domain.edu>"
 *                     Defaults to Resend's onboarding sandbox when unset.
 */

import { Resend } from "resend";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const DEFAULT_FROM = "Vanderbilt Learning Reels <onboarding@resend.dev>";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const resend = getResend();

  if (!resend) {
    // Dev fallback: no key configured, just log.
    // eslint-disable-next-line no-console
    console.log("\n──────── EMAIL (dev, no RESEND_API_KEY) ────────");
    console.log("To:     ", message.to);
    console.log("Subject:", message.subject);
    console.log("Body:");
    console.log(message.text);
    console.log("────────────────────────────────────────────────\n");
    return;
  }

  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  const { error } = await resend.emails.send({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.name ?? ""} ${error.message ?? JSON.stringify(error)}`.trim());
  }
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

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1C1C1C; line-height: 1.5;">
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received a request to reset your Learning Reels password.</p>
    <p>
      <a href="${escapeAttr(resetUrl)}"
         style="display:inline-block;padding:12px 20px;background:#866D4B;color:#fff;text-decoration:none;border-radius:4px;font-weight:600;">
        Reset your password
      </a>
    </p>
    <p style="color:#555;font-size:14px;">This link expires in ${expiresInMinutes} minutes.</p>
    <p style="color:#555;font-size:14px;">If you did not request a password reset, you can safely ignore this email.</p>
    <p style="color:#888;font-size:12px;">— Vanderbilt Learning Reels</p>
  </body>
</html>`;

  return {
    to,
    subject: "Reset your Learning Reels password",
    text,
    html,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c] as string));
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
