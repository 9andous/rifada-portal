// Development accounts, one per non-admin role, for checking role routing locally.
// All records are flagged isDemo (removed by the demo wipe in Phase 7). The password is read
// from DEV_USERS_PASSWORD in .env; nothing is hard-coded. Run with `npm run db:seed:dev-users`.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { createUserWithPassword } from "../../src/server/auth/users";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const password = process.env.DEV_USERS_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error("Set DEV_USERS_PASSWORD (10+ characters) in .env to create development accounts.");
  }

  const association =
    (await db.association.findFirst({ where: { isDemo: true, name: "جمعية تجريبية للتطوير" } })) ??
    (await db.association.create({ data: { name: "جمعية تجريبية للتطوير", city: "مكة المكرمة", isDemo: true } }));

  const accounts = [
    { username: "dev.manager", name: "مدير الوحدة (تطوير)", role: "UNIT_MANAGER" as const },
    { username: "dev.supervisor", name: "مشرف (تطوير)", role: "SUPERVISOR" as const },
    {
      username: "dev.association",
      name: "مسؤول الجمعية (تطوير)",
      role: "ASSOCIATION_OFFICER" as const,
      associationId: association.id,
      // Fictitious ID used only by the mock Nafath sign-in.
      nationalId: "1000000001",
    },
  ];

  for (const account of accounts) {
    if (await db.user.findUnique({ where: { username: account.username } })) {
      console.log(`  ${account.username} already exists`);
      continue;
    }
    await createUserWithPassword(db, { ...account, password, mustChangePassword: false, isDemo: true });
    console.log(`  created ${account.username}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
