import { defineConfig } from "prisma/config";
import path from "path";
import { readFileSync } from "fs";

// Load DATABASE_URL — needed for db push / migrate commands.
// Falls back gracefully during prisma generate (where URL is optional).
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
  // Return empty string instead of throwing — prisma generate doesn't need it
  return "";
}

const url = loadDatabaseUrl();

export default defineConfig({
  schema: path.join(__dirname, "schema.prisma"),
  datasource: { url: url || "postgresql://localhost:5432/placeholder" },
});
