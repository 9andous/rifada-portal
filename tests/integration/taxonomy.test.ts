import { beforeEach, describe, expect, it } from "vitest";
import { seedTaxonomy } from "../../prisma/seed/taxonomy";
import { ROLES } from "@/server/authz/roles";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import { getTaxonomy, getTaxonomyReview } from "@/server/services/taxonomy";
import { db, resetDatabase } from "../support/db";

const actor = (role: Actor["role"]): Actor => ({ id: "u1", role, associationId: null, trackIds: [] });

async function seedObjectives() {
  for (let number = 1; number <= 7; number++) {
    await db.strategicObjective.create({ data: { number, title: `الهدف ${number}` } });
  }
}

describe("taxonomy seed", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedObjectives();
  });

  it("loads 7 programs, 143 initiatives and their links, and is idempotent", async () => {
    expect(await seedTaxonomy(db)).toEqual({ createdInitiatives: 143 });
    expect(await seedTaxonomy(db)).toEqual({ createdInitiatives: 0 });

    const programs = await db.program.findMany({ orderBy: { number: "asc" }, include: { _count: { select: { initiatives: true, goals: true } } } });
    expect(programs.map((p) => p._count.initiatives)).toEqual([13, 30, 26, 16, 13, 27, 18]);
    expect(programs.map((p) => p._count.goals)).toEqual([12, 13, 19, 7, 17, 5, 6]);
    expect(await db.initiativeObjectiveLink.count()).toBe(670);
    expect(programs[5].officialName).toContain("هيئة الأمر بالمعروف");
  });

  it("does not overwrite records edited after seeding", async () => {
    await seedTaxonomy(db);
    const initiative = await db.initiative.findFirstOrThrow({ where: { number: 1, program: { number: 1 } } });
    await db.initiative.update({ where: { id: initiative.id }, data: { name: "اسم معدل" } });
    await seedTaxonomy(db);
    expect((await db.initiative.findUniqueOrThrow({ where: { id: initiative.id } })).name).toBe("اسم معدل");
  });
});

describe("taxonomy loaders", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedObjectives();
    await seedTaxonomy(db);
  });

  it("lets every role read the taxonomy", async () => {
    for (const role of ROLES) {
      const taxonomy = await getTaxonomy(actor(role));
      expect(taxonomy.programs).toHaveLength(7);
      expect(taxonomy.linkCount).toBe(670);
    }
  });

  it("restricts the review page data to the super admin", async () => {
    for (const role of ROLES) {
      if (role === "SUPER_ADMIN") continue;
      await expect(getTaxonomyReview(actor(role))).rejects.toBeInstanceOf(ForbiddenError);
    }
    const review = await getTaxonomyReview(actor("SUPER_ADMIN"));
    expect(review.missing).toEqual([]);
    expect(review.uncertainCells).toEqual([]);
    expect(review.cellsRead).toBe(143 * 7);
    expect(review.programs.flatMap((p) => p.initiatives).filter((i) => i.differsFromSource)).toEqual([]);
    expect(review.programs.flatMap((p) => p.initiatives).every((i) => i.source?.sourcePage)).toBe(true);
  });

  it("flags initiatives whose links no longer match the extraction", async () => {
    const initiative = await db.initiative.findFirstOrThrow({ where: { number: 7, program: { number: 1 } } });
    await db.initiativeObjectiveLink.deleteMany({ where: { initiativeId: initiative.id } });
    const review = await getTaxonomyReview(actor("SUPER_ADMIN"));
    const flagged = review.programs.flatMap((p) => p.initiatives).filter((i) => i.differsFromSource);
    expect(flagged.map((i) => i.id)).toEqual([initiative.id]);
  });
});
