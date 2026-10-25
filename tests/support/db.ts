import { db } from "@/server/db";

/** Empties every table in the test database (never the dev database; see vitest.config.ts). */
export async function resetDatabase() {
  if (!process.env.DATABASE_URL?.includes("_test")) throw new Error("Not a test database");
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export { db };
