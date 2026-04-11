import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy endpoint for Pollinations AI images.
 * Fetches the image server-side to avoid browser ORB/CORS blocking.
 * GET /api/images/proxy?url=<encoded-pollinations-url>
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Image proxy failed" },
      { status: 502 }
    );
  }
}
