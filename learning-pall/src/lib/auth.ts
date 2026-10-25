import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "./db";
import { getAuthSecret } from "./auth-secret";

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

/**
 * Short fingerprint of the user's current password hash, stored in the JWT.
 * Changing or resetting the password changes the fingerprint, which revokes
 * every session issued before the change.
 */
function passwordVersion(passwordHash: string): string {
  return crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

export async function signSession(p: SessionPayload) {
  const user = await prisma.user.findUnique({
    where: { id: p.uid },
    select: { passwordHash: true },
  });
  if (!user) throw new Error("Cannot sign a session for a missing user");
  return await new SignJWT({
    ...(p as unknown as Record<string, unknown>),
    pwv: passwordVersion(user.passwordHash),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getAuthSecret());
}

/**
 * Verifies the JWT, then checks it against the database: the account must
 * still exist, be active and not deleted, and the password must not have
 * changed since the token was issued. Role, name and email come from the
 * database so admin changes take effect immediately.
 */
async function verifySessionToken(
  token: string
): Promise<(SessionPayload & { iat: number }) | null> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, getAuthSecret()));
  } catch {
    return null;
  }
  if (typeof payload.uid !== "string" || typeof payload.pwv !== "string") return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: { id: true, email: true, name: true, role: true, status: true, deletedAt: true, passwordHash: true },
  });
  if (!user || user.deletedAt || user.status !== "active") return null;
  if (payload.pwv !== passwordVersion(user.passwordHash)) return null;
  return {
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    iat: typeof payload.iat === "number" ? payload.iat : 0,
  };
}

export async function readSession(): Promise<SessionPayload | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  const s = await verifySessionToken(token);
  if (!s) return null;
  return { uid: s.uid, email: s.email, name: s.name, role: s.role };
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
  return verifySessionToken(token);
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
