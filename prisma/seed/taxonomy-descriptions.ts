// Programme and initiative descriptions (prisma/seed/taxonomy-descriptions.json), shown to the
// association when it chooses where a new request belongs (D-121). Fill-only: a description is
// written only where none is set, so texts edited later in the admin taxonomy editors are kept.
// Runs with the baseline seed, or alone on an existing database with `npm run db:seed:descriptions` (fill-descriptions.ts).

import type { PrismaClient } from "../../src/generated/prisma/client";
import descriptions from "./taxonomy-descriptions.json";

type Descriptions = { programs: { number: number; description: string; initiatives: Record<string, string> }[] };

export async function seedTaxonomyDescriptions(db: PrismaClient, source: Descriptions = descriptions as Descriptions) {
  let filled = 0;
  for (const p of source.programs) {
    const program = await db.program.findUnique({ where: { number: p.number }, select: { id: true } });
    if (!program) continue;
    filled += (await db.program.updateMany({ where: { id: program.id, OR: [{ description: null }, { description: "" }] }, data: { description: p.description } })).count;
    for (const [number, description] of Object.entries(p.initiatives)) {
      filled += (
        await db.initiative.updateMany({
          where: { programId: program.id, number: Number(number), OR: [{ description: null }, { description: "" }] },
          data: { description },
        })
      ).count;
    }
  }
  return { filled };
}

