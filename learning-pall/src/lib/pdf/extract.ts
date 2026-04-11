/**
 * Source extraction utilities. Given a file (or text/url), produce plain text
 * suitable for sending to Claude as context for reel generation.
 */
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

const LIBREOFFICE_CANDIDATES = [
  process.env.LIBREOFFICE_PATH,
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  "/usr/bin/soffice",
  "/usr/local/bin/soffice",
  "soffice",
].filter(Boolean) as string[];

async function findLibreOffice(): Promise<string | null> {
  for (const candidate of LIBREOFFICE_CANDIDATES) {
    try {
      await exec(candidate, ["--version"]);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

async function extractPdf(buf: Buffer): Promise<string> {
  // pdf-parse v2 exposes a default async function
  const mod = await import("pdf-parse");
  const pdfParse = (mod as { default?: (b: Buffer) => Promise<{ text: string }> }).default ?? (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
  const result = await pdfParse(buf);
  return (result.text || "").trim();
}

async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: buf });
  return (result.value || "").trim();
}

async function extractViaLibreOffice(buf: Buffer, ext: string): Promise<string> {
  const soffice = await findLibreOffice();
  if (!soffice) {
    throw new Error(
      "LibreOffice not found. Install LibreOffice or set LIBREOFFICE_PATH to convert pptx/doc files."
    );
  }
  // Write input to a temp dir, convert to PDF, then extract text
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lr-extract-"));
  try {
    const inputPath = path.join(tmp, `input${ext}`);
    await fs.writeFile(inputPath, buf);
    await exec(soffice, [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      tmp,
      inputPath,
    ]);
    const pdfPath = path.join(tmp, `input.pdf`);
    const pdfBuf = await fs.readFile(pdfPath);
    return await extractPdf(pdfBuf);
  } finally {
    // best-effort cleanup
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

export type ExtractResult = {
  text: string;
  mime: string;
};

/**
 * Extract plain text from an uploaded file. Supports PDF, DOCX, PPTX (via
 * LibreOffice), TXT, and Markdown.
 */
export async function extractFromFile(
  buf: Buffer,
  filename: string,
  mime: string
): Promise<ExtractResult> {
  const ext = (path.extname(filename) || "").toLowerCase();
  if (ext === ".pdf" || mime === "application/pdf") {
    return { text: await extractPdf(buf), mime: "application/pdf" };
  }
  if (
    ext === ".docx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return { text: await extractDocx(buf), mime: "docx" };
  }
  if (
    ext === ".pptx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return { text: await extractViaLibreOffice(buf, ".pptx"), mime: "pptx" };
  }
  if (ext === ".doc") {
    return { text: await extractViaLibreOffice(buf, ".doc"), mime: "doc" };
  }
  if (ext === ".ppt") {
    return { text: await extractViaLibreOffice(buf, ".ppt"), mime: "ppt" };
  }
  if (ext === ".txt" || ext === ".md" || mime.startsWith("text/")) {
    return { text: buf.toString("utf-8"), mime: "text/plain" };
  }
  throw new Error(`Unsupported file type: ${filename} (${mime})`);
}
