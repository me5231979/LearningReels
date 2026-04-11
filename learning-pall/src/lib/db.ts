import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is not set");
    // @prisma/adapter-neon@7.x takes a neon.PoolConfig, not a neon() client.
    // Passing { connectionString } gives the adapter the info it needs so
    // Prisma doesn't fall back to "No database host or connection string was set".
    const adapter = new PrismaNeon({ connectionString: url });
    _prisma = new PrismaClient({ adapter });
  }
  return _prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as any)[prop];
  }
});
