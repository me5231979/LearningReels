import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  readSession,
  signSession,
  setSessionCookie,
  hashPassword,
  type Role,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidDepartment } from "@/lib/departments";

export async function PATCH(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!me) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data: {
    department?: string;
    name?: string;
    email?: string;
    jobTitle?: string | null;
    passwordHash?: string;
  } = {};

  // ── Department ──
  if (typeof body.department === "string") {
    if (!isValidDepartment(body.department)) {
      return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }
    data.department = body.department;
  }

  // ── Name ──
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (trimmed.length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters" },
        { status: 400 }
      );
    }
    data.name = trimmed;
  }

  // ── Job title (optional, nullable) ──
  if (body.jobTitle !== undefined) {
    if (body.jobTitle === null || body.jobTitle === "") {
      data.jobTitle = null;
    } else if (typeof body.jobTitle === "string") {
      data.jobTitle = body.jobTitle.trim();
    } else {
      return NextResponse.json({ error: "Invalid job title" }, { status: 400 });
    }
  }

  // ── Email (requires current password) ──
  if (typeof body.email === "string" && body.email.trim() !== me.email) {
    const newEmail = body.email.trim().toLowerCase();
    if (!newEmail.includes("@") || newEmail.length < 5) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (typeof body.currentPassword !== "string" || !body.currentPassword) {
      return NextResponse.json(
        { error: "Current password required to change email" },
        { status: 400 }
      );
    }
    const ok = await bcrypt.compare(body.currentPassword, me.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== me.id) {
      return NextResponse.json(
        { error: "That email is already in use" },
        { status: 409 }
      );
    }
    data.email = newEmail;
  }

  // ── Password change (requires current password) ──
  if (typeof body.newPassword === "string" && body.newPassword.length > 0) {
    if (body.newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (typeof body.currentPassword !== "string" || !body.currentPassword) {
      return NextResponse.json(
        { error: "Current password required to change password" },
        { status: 400 }
      );
    }
    const ok = await bcrypt.compare(body.currentPassword, me.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }
    data.passwordHash = await hashPassword(body.newPassword);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: me.id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      jobTitle: true,
    },
  });

  // If name or email changed, refresh the JWT cookie so the session
  // payload stays in sync with the new values.
  if (data.name || data.email) {
    const token = await signSession({
      uid: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    });
    await setSessionCookie(token);
  }

  return NextResponse.json({ user });
}
