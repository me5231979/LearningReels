import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signSession, setSessionCookie, type Role } from "@/lib/auth";
import { isValidDepartment } from "@/lib/departments";

const VANDERBILT_DOMAIN = "@vanderbilt.edu";

export async function POST(request: NextRequest) {
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

  const existing = await prisma.user.findUnique({ where: { email: rawEmail } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const isVanderbiltEmail = rawEmail.endsWith(VANDERBILT_DOMAIN);
  const status = isVanderbiltEmail ? "active" : "pending_approval";
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

  // Auto-login approved users
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
      department: user.department,
    },
  });
}
