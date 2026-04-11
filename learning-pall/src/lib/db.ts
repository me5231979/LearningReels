import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_mjEH7AFb2XCo@ep-mute-cake-amsgy8nu-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);
const adapter = new PrismaNeon(sql);
export const prisma = new PrismaClient({ adapter });
