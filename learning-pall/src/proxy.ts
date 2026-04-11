import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "lr-dev-secret-change-in-production"
);
const COOKIE = "lr_session";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
];
const STATIC_PREFIXES = ["/_next", "/favicon", "/manifest.json", "/sw.js", "/icons", "/animations", "/generated"];
const STATIC_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".woff", ".woff2", ".ttf", ".css", ".js", ".map"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static file extensions (images, fonts, etc.)
  if (STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    return NextResponse.next();
  }
  // Allow static prefixes and public paths
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check session
  const token = request.cookies.get(COOKIE)?.value;
  let session: { uid: string; role: string } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      session = payload as unknown as { uid: string; role: string };
    } catch {
      // Invalid token — clear and redirect
    }
  }

  // Not authenticated → login
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user on /login → redirect to app
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // Root → app home
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // Legacy HELM routes → app home (HELM removed)
  if (
    pathname.startsWith("/course") ||
    pathname.startsWith("/certificate")
  ) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // Admin portal: only admin or super_admin
  if (pathname.startsWith("/admin")) {
    if (session.role !== "admin" && session.role !== "super_admin") {
      return NextResponse.redirect(new URL("/home", request.url));
    }
  }

  // Admin-only API routes
  if (pathname.startsWith("/api/admin")) {
    if (session.role !== "admin" && session.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}
