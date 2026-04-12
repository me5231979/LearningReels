import { defineConfig } from "prisma/config";
import path from "path";
import { readFileSync } from "fs";

// Load DATABASE_URL from .env.local since Prisma CLI doesn't read it natively
function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of [".env.local", ".env"]) {
    try {
      const content = readFileSync(path.join(process.cwd(), f), "utf-8");
      for (const line of content.split("\n")) {
        const m = line.match(/^DATABASE_URL=['"]?([^'"\s]+)['"]?\s*$/);
        if (m) return m[1];
      }
    } catch {}
  }
  throw new Error("DATABASE_URL not found in environment or .env files");
}

export default defineConfig({
  schema: path.join(__dirname, "schema.prisma"),
  datasource: { url: loadDatabaseUrl() },
});
