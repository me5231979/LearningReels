import { readFile } from "fs/promises";

export async function extractText(
  filepath: string,
  mimeType: string
): Promise<string> {
  if (mimeType === "text/plain") {
    return readFile(filepath, "utf-8");
  }

  if (mimeType === "application/pdf") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const buffer = await readFile(filepath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const buffer = await readFile(filepath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
