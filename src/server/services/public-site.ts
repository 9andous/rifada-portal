import "server-only";
import { connection } from "next/server";
import { db } from "@/server/db";
import { availableInitiativeWhere, availableProgramWhere } from "@/server/services/taxonomy";

// Public home page content (no session). Everything comes from the database so the unit's edits
// to the strategy texts and programmes show without a release; nothing here is invented.

export type PublicHome = {
  vision: string | null;
  mission: string | null;
  values: { number: number; title: string; description: string }[];
  objectives: { number: number; title: string }[];
  programs: { number: number; name: string; initiativeCount: number }[];
};

export async function getPublicHome(): Promise<PublicHome> {
  await connection();
  const [content, values, objectives, programs] = await Promise.all([
    db.siteContent.findMany({ where: { key: { in: ["vision", "mission"] } } }),
    db.coreValue.findMany({ orderBy: { number: "asc" } }),
    db.strategicObjective.findMany({ where: { archivedAt: null }, orderBy: { number: "asc" }, select: { number: true, title: true } }),
    db.program.findMany({
      where: availableProgramWhere,
      orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
      select: { number: true, name: true, _count: { select: { initiatives: { where: availableInitiativeWhere } } } },
    }),
  ]);
  const text = (key: string) => content.find((c) => c.key === key)?.value ?? null;
  return {
    vision: text("vision"),
    mission: text("mission"),
    values: values.map(({ number, title, description }) => ({ number, title, description })),
    objectives,
    programs: programs.map((p) => ({ number: p.number, name: p.name, initiativeCount: p._count.initiatives })),
  };
}
