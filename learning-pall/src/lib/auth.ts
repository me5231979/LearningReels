import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "lr-dev-secret-change-in-production"
);
const COOKIE = "lr_session";

export type Role = "learner" | "admin" | "super_admin";

export type SessionPayload = {
  uid: string;
  email: string;
  name: string;
  role: Role;
};

export function isAdminRole(role: string | undefined | null): boolean {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdminRole(role: string | undefined | null): boolean {
  return role === "super_admin";
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user || !isAdminRole(user.role) || user.deletedAt) return null;
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (!user || !isSuperAdminRole(user.role) || user.deletedAt) return null;
  return user;
}

export async function signSession(p: SessionPayload) {
  return await new SignJWT(p as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function readSession(): Promise<SessionPayload | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Like readSession but also returns the JWT `iat` (issued-at, in seconds).
 * Used to dedupe per-login events such as comm impression counting.
 */
export async function readSessionWithIat(): Promise<
  (SessionPayload & { iat: number }) | null
> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const iat = typeof payload.iat === "number" ? payload.iat : 0;
    return { ...(payload as unknown as SessionPayload), iat };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });
  return user;
}

export async function requireUser() {
  const s = await readSession();
  if (!s) return null;
  const user = await prisma.user.findUnique({ where: { id: s.uid } });
  return user;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
