import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    // Not required for `prisma generate` (e.g. during `npm ci` in Docker); migrate and seed need it.
    url: process.env.DATABASE_URL ?? "",
  },
});
