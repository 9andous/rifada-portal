// Fills empty programme and initiative descriptions on an existing database (D-121), without the
// rest of the baseline seed. Run with `npm run db:seed:descriptions`.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { seedTaxonomyDescriptions } from "./taxonomy-descriptions";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

seedTaxonomyDescriptions(db)
  .then(({ filled }) => console.log(`taxonomy descriptions: ${filled} filled`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
