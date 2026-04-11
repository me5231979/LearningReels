import { NextRequest, NextResponse } from "next/server";
import { login, signSession, setSessionCookie, type Role } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
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
