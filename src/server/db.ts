import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Reuse one client across hot reloads in development.
const globalForDb = globalThis as unknown as { rifadaDb?: ReturnType<typeof createClient> };

export const db = globalForDb.rifadaDb ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.rifadaDb = db;

export type Db = typeof db;
