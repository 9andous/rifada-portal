// Taxonomy seed: the 7 programs, their goals, 143 initiatives and initiative-to-objective links
// extracted from the strategy outline (private PDF) in Phase 1b (prisma/seed/taxonomy.json).
// Create-only and idempotent: records that already exist are left as they are, so edits made later
// in the admin editors are never overwritten by a re-seed.

import type { PrismaClient } from "../../src/generated/prisma/client";
import { TAXONOMY_SOURCE, type TaxonomySource } from "../../src/lib/taxonomy-source";

export async function seedTaxonomy(db: PrismaClient, taxonomy: TaxonomySource = TAXONOMY_SOURCE) {
  const objectives = new Map((await db.strategicObjective.findMany()).map((o) => [o.number, o.id]));
  let createdInitiatives = 0;

  for (const p of taxonomy.programs) {
    await db.$transaction(async (tx) => {
      const program = await tx.program.upsert({
        where: { number: p.number },
        create: { number: p.number, name: p.name, officialName: p.officialName ?? null, sortOrder: p.number },
        update: {},
      });
      for (const [index, text] of p.goals.entries()) {
        await tx.programGoal.upsert({
          where: { programId_number: { programId: program.id, number: index + 1 } },
          create: { programId: program.id, number: index + 1, text },
          update: {},
        });
      }
      for (const i of p.initiatives) {
        const existing = await tx.initiative.findUnique({ where: { programId_number: { programId: program.id, number: i.number } } });
        if (existing) continue;
        const initiative = await tx.initiative.create({
          data: { programId: program.id, number: i.number, name: i.name, sourceNote: i.sourceNote ?? null },
        });
        await tx.initiativeObjectiveLink.createMany({
          data: i.objectives.map((n) => {
            const objectiveId = objectives.get(n);
            if (!objectiveId) throw new Error(`Strategic objective ${n} is missing; seed site content first.`);
            return { initiativeId: initiative.id, objectiveId };
          }),
        });
        createdInitiatives++;
      }
    });
  }
  return { createdInitiatives };
}
