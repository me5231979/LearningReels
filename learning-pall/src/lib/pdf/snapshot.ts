/**
 * URL → text + PDF snapshot. Used by the URL ingest path.
 *
 * Uses fetch + html-to-text instead of Puppeteer so it works on
 * Vercel's serverless environment (no Chrome binary needed).
 */
import { convert } from "html-to-text";

export type UrlIngestResult = {
  title: string;
  text: string;
  pdfBuffer: Buffer | null;
};

export async function ingestUrl(url: string): Promise<UrlIngestResult> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();

  // Extract title from <title> tag
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/\s+/g, " ").trim()
    : url;

  const text = convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
      { selector: "nav", format: "skip" },
      { selector: "footer", format: "skip" },
      { selector: "header", format: "skip" },
      { selector: "aside", format: "skip" },
      { selector: "noscript", format: "skip" },
      { selector: "iframe", format: "skip" },
    ],
  });

  // No PDF snapshot in serverless — the branded PDF is generated separately
  return { title, text: text.trim(), pdfBuffer: null };
}
