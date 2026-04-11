import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { existsSync } from "fs";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function resolveDbPath(): string {
  // Candidate paths in order of preference
  const candidates = [
    path.join(process.cwd(), "data", "learning-pall.db"),
    path.join(process.cwd(), "learning-pall", "data", "learning-pall.db"),
    path.resolve(__dirname, "..", "..", "..", "data", "learning-pall.db"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  // Absolute fallback — always valid
  return "/Users/estesm4/Desktop/Learning Pall/learning-pall/data/learning-pall.db";
}

function createPrismaClient() {
  const dbPath = resolveDbPath();
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
