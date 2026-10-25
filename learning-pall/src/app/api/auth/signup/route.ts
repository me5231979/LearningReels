import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { isValidDepartment } from "@/lib/departments";
import { sendVerificationEmail, VERIFY_TTL_HOURS } from "@/lib/email-verification";
import { rateLimit, tooManyRequests, clientIp } from "@/lib/rate-limit";

const VANDERBILT_DOMAIN = "@vanderbilt.edu";

function verifyPendingResponse(email: string) {
  return NextResponse.json({
    pending: true,
    title: "Check your email",
    message: `We sent a confirmation link to ${email}. Open it within ${VERIFY_TTL_HOURS} hours to activate your account.`,
  });
}

export async function POST(request: NextRequest) {
  if (!rateLimit(`signup:${clientIp(request)}`, 10, 60 * 60 * 1000)) {
    return tooManyRequests();
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const department = typeof body.department === "string" ? body.department.trim() : "";

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 }
    );
  }
  if (!rawEmail || !rawEmail.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (!isValidDepartment(department)) {
    return NextResponse.json(
      { error: "Please select your department" },
      { status: 400 }
    );
  }

  const origin =
    process.env.APP_URL || request.nextUrl.origin || "http://localhost:3000";

  const existing = await prisma.user.findUnique({ where: { email: rawEmail } });
  if (existing?.status === "pending_verification" && !existing.deletedAt) {
    // Signing up again before confirming: resend the link (at most 3 an hour).
    if (rateLimit(`verify-resend:${existing.id}`, 3, 60 * 60 * 1000)) {
      await sendVerificationEmail(existing, origin);
    }
    return verifyPendingResponse(existing.email);
  }
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const isVanderbiltEmail = rawEmail.endsWith(VANDERBILT_DOMAIN);
  // Vanderbilt addresses skip admin approval but must confirm they own the inbox.
  const status = isVanderbiltEmail ? "pending_verification" : "pending_approval";
  const passwordHash = await hashPassword(password);
  const name = `${firstName} ${lastName}`;

  const user = await prisma.user.create({
    data: {
      email: rawEmail,
      passwordHash,
      name,
      role: "learner",
      status,
      department,
    },
  });

  if (!isVanderbiltEmail) {
    return NextResponse.json({
      pending: true,
      message:
        "Thanks! Your account has been submitted for admin approval. You'll be notified once approved.",
    });
  }

  await sendVerificationEmail(user, origin);
  return verifyPendingResponse(user.email);
}
