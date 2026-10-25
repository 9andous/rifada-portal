// A small taxonomy for the Phase 2b tests: 7 objectives, 2 programs with goals and initiatives,
// the seeded attachment types. Faster than loading all 143 initiatives for every test.

import { seedAttachmentTypes } from "../../prisma/seed/attachment-types";
import { db } from "./db";

export async function makeTaxonomy() {
  for (let number = 1; number <= 7; number++) {
    await db.strategicObjective.create({ data: { number, title: `الهدف الإستراتيجي ${number}` } });
  }
  const p1 = await db.program.create({ data: { number: 1, name: "برنامج الأئمة والمؤذنين", sortOrder: 1 } });
  const p2 = await db.program.create({ data: { number: 2, name: "برنامج الدروس العلمية", sortOrder: 2 } });
  for (const [programId, count] of [
    [p1.id, 3],
    [p2.id, 4],
  ] as const) {
    for (let number = 1; number <= count; number++) {
      await db.programGoal.create({ data: { programId, number, text: `الهدف ${number} للبرنامج` } });
    }
  }
  const initiatives = [];
  for (const [program, count] of [
    [p1, 3],
    [p2, 4],
  ] as const) {
    for (let number = 1; number <= count; number++) {
      initiatives.push(await db.initiative.create({ data: { programId: program.id, number, name: `مبادرة ${program.number}-${number}` } }));
    }
  }
  await seedAttachmentTypes(db);
  const types = await db.attachmentType.findMany({ orderBy: { key: "asc" } });
  const objectives = await db.strategicObjective.findMany({ orderBy: { number: "asc" } });
  return { programs: [p1, p2], initiatives, types, objectives };
}
