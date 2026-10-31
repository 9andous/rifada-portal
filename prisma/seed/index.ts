// Baseline seed: reference data every installation needs. Idempotent; safe to re-run.
// Creates no demo or operational records. Run with `npm run db:seed`.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { createUserWithPassword } from "../../src/server/auth/users";
import { LEADERSHIP_QUOTES, PRESIDENT_WORD } from "../../src/config/initiative";
import { SETTING_DEFAULTS } from "../../src/server/settings/defaults";
import { seedAttachmentTypes } from "./attachment-types";
import { seedStatuses } from "./statuses";
import { seedTaxonomy } from "./taxonomy";
import { seedTaxonomyDescriptions } from "./taxonomy-descriptions";
import { seedTracks } from "./tracks";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), "utf8")) as T;
}

type SiteContent = {
  vision: string;
  mission: string;
  values: { number: number; title: string; description: string }[];
  objectives: { number: number; title: string }[];
};

async function seedSiteContent() {
  const content = readJson<SiteContent>("site-content.json");
  for (const key of ["vision", "mission"] as const) {
    await db.siteContent.upsert({ where: { key }, create: { key, value: content[key] }, update: {} });
  }
  for (const v of content.values) {
    await db.coreValue.upsert({ where: { number: v.number }, create: v, update: {} });
  }
  for (const o of content.objectives) {
    await db.strategicObjective.upsert({ where: { number: o.number }, create: o, update: {} });
  }
}

/** The three statements of the strategy outline, only into an empty table so admin edits stay. */
async function seedHomeQuotes() {
  if (await db.homeQuote.count()) return;
  const quotes = [...LEADERSHIP_QUOTES, PRESIDENT_WORD];
  for (const [i, q] of quotes.entries()) {
    await db.homeQuote.create({
      data: { quote: q.quote, honorific: q.honorific, name: q.name, title: q.title, imagePath: q.image, sortOrder: i + 1 },
    });
  }
}

async function seedSettings() {
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
}

async function seedFirstAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD must be set in .env before seeding.");
  }
  if (password.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters.");

  const existing = await db.user.findUnique({ where: { username: username.toLowerCase() } });
  if (existing) {
    console.log(`  super admin "${username}" already exists, left unchanged`);
    return;
  }
  const user = await createUserWithPassword(db, {
    username,
    password,
    name: process.env.SEED_ADMIN_NAME?.trim() || "مدير النظام",
    role: "SUPER_ADMIN",
    mustChangePassword: true,
  });
  await db.auditLog.create({
    data: { actorId: null, action: "user.created", entityType: "User", entityId: user.id, after: { username, role: "SUPER_ADMIN", source: "seed" } },
  });
  console.log(`  created super admin "${username}" (must change password on first login)`);
}

async function main() {
  console.log("Seeding baseline data…");
  await seedSiteContent();
  await seedHomeQuotes();
  const { createdInitiatives } = await seedTaxonomy(db);
  console.log(`  taxonomy: ${createdInitiatives} initiatives created`);
  const { filled } = await seedTaxonomyDescriptions(db);
  console.log(`  taxonomy descriptions: ${filled} filled`);
  const { created: tracks } = await seedTracks(db);
  console.log(`  tracks: ${tracks} created`);
  await seedStatuses(db);
  const { created: attachmentTypes } = await seedAttachmentTypes(db);
  console.log(`  attachment types: ${attachmentTypes} created`);
  await seedSettings();
  await seedFirstAdmin();
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
