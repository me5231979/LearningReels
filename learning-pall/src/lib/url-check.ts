/**
 * Lightweight URL liveness checker.
 *
 * Used after AI reel generation to verify that sourceUrls actually exist
 * before persisting them. Returns the final URL (following redirects) or
 * null if the URL is dead/hallucinated.
 */
export async function checkUrlAlive(
  url: string,
  timeoutMs = 10000
): Promise<string | null> {
  if (!url || !url.startsWith("http")) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "HEAD", // lightweight — no body download
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/html,*/*",
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      // Return final URL (resolves redirects)
      return res.url || url;
    }

    // Some sites block HEAD but allow GET — retry with GET
    if (res.status === 403 || res.status === 405) {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), timeoutMs);
      const res2 = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller2.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "text/html,*/*",
        },
      });
      clearTimeout(timeout2);
      if (res2.ok) return res2.url || url;
    }

    return null;
  } catch {
    return null;
  }
}
