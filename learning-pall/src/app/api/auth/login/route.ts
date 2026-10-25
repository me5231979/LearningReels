import { NextRequest, NextResponse } from "next/server";
import { login, signSession, setSessionCookie, type Role } from "@/lib/auth";
import { rateLimit, tooManyRequests, clientIp } from "@/lib/rate-limit";

const FIFTEEN_MIN = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  // Slow down password guessing: per account and per client IP.
  const ip = clientIp(request);
  if (
    !rateLimit(`login:acct:${email.trim().toLowerCase()}`, 10, FIFTEEN_MIN) ||
    !rateLimit(`login:ip:${ip}`, 50, FIFTEEN_MIN)
  ) {
    return tooManyRequests();
  }

  const user = await login(email, password);
  if (!user || user.deletedAt) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  if (user.status === "pending_approval") {
    return NextResponse.json(
      {
        error:
          "Your account is pending admin approval. You'll receive access once approved.",
      },
      { status: 403 }
    );
  }

  if (user.status === "pending_verification") {
    return NextResponse.json(
      {
        error:
          "Please confirm your email first. Check your inbox for the link, or sign up again to get a new one.",
      },
      { status: 403 }
    );
  }

  if (user.status === "denied") {
    return NextResponse.json(
      { error: "This account has been denied access." },
      { status: 403 }
    );
  }

  const token = await signSession({
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
  });

  await setSessionCookie(token);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      onboardedAt: user.onboardedAt,
    },
  });
}
