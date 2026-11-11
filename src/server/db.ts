import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Reuse one client across hot reloads in development, unless `prisma generate` has replaced the
// class: an old client rejects fields of the new schema until the server restarts (D-135).
const globalForDb = globalThis as unknown as { rifadaDb?: ReturnType<typeof createClient>; rifadaDbClass?: unknown };

if (globalForDb.rifadaDb && globalForDb.rifadaDbClass !== PrismaClient) {
  void globalForDb.rifadaDb.$disconnect();
  globalForDb.rifadaDb = undefined;
}

export const db = globalForDb.rifadaDb ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.rifadaDb = db;
  globalForDb.rifadaDbClass = PrismaClient;
}

export type Db = typeof db;
