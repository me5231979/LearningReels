import { defineConfig } from "prisma/config";
import { neon } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";

const sql = neon("postgresql://neondb_owner:npg_mjEH7AFb2XCo@ep-mute-cake-amsgy8nu-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");
const adapter = new PrismaNeon(sql);

export default defineConfig({
  datasource: {
    adapter,
  },
});
