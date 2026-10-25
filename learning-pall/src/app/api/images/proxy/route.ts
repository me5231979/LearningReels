import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy endpoint for Pollinations AI images.
 * Fetches the image server-side to avoid browser ORB/CORS blocking.
 * GET /api/images/proxy?url=<encoded-pollinations-url>
 *
 * Only Pollinations image URLs are fetched, redirects are not followed, and
 * only image responses are passed back. Without these limits the route
 * could fetch internal URLs (SSRF) or serve attacker HTML on our origin.
 */
const ALLOWED_HOSTS = new Set(["image.pollinations.ai"]);

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname) || target.port) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(target, { redirect: "error", next: { revalidate: 86400 } });

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !/^image\/(png|jpeg|webp|gif)\b/i.test(contentType)) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: 502 }
      );
    }

    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Image proxy failed" },
      { status: 502 }
    );
  }
}
