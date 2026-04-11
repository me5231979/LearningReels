/**
 * URL → text + PDF snapshot. Used by the URL ingest path.
 */
import { convert } from "html-to-text";

export type UrlIngestResult = {
  title: string;
  text: string;
  pdfBuffer: Buffer;
};

export async function ingestUrl(url: string): Promise<UrlIngestResult> {
  // Defer puppeteer import — heavy module, only load when needed
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    const title = (await page.title()) || url;
    const html = await page.content();
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    });

    const text = convert(html, {
      wordwrap: false,
      selectors: [
        { selector: "a", options: { ignoreHref: true } },
        { selector: "img", format: "skip" },
        { selector: "script", format: "skip" },
        { selector: "style", format: "skip" },
        { selector: "nav", format: "skip" },
        { selector: "footer", format: "skip" },
      ],
    });

    return { title, text: text.trim(), pdfBuffer: Buffer.from(pdf) };
  } finally {
    await browser.close().catch(() => {});
  }
}
