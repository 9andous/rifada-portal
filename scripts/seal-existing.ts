// One-off backfill for D-122: seals the evaluations and approvals signed before electronic seals
// existed (the drawn signatures, removed by the migration), dated as they were signed.
//   npm run seal:backfill
// Idempotent: only rows without a seal are sealed.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { sealUnsealed } from "../src/server/seal/seal";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const done = await sealUnsealed(db);
  console.log(`Sealed ${done.evaluations} evaluation(s) and ${done.approvals} approval(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
