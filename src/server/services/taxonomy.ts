import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { TAXONOMY_SOURCE, type SourceInitiative } from "@/lib/taxonomy-source";
import { can, type Action } from "@/server/authz/permissions";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import { db } from "@/server/db";

// Read-only taxonomy loaders (Phase 1b); the editors are in services/admin/taxonomy-editor.ts.
// Every loader checks the actor's permission itself, so a page can never show taxonomy data by
// relying on the layout alone.

/**
 * Derived availability (D-052): a program that is archived or paused («موقوف») is hidden, with all its
 * initiatives, from the request form and public pages. The initiatives' own flags are not touched,
 * so restoring or reactivating the program brings them back as they were.
 */
export const availableProgramWhere = { archivedAt: null, isActive: true } satisfies Prisma.ProgramWhereInput;

/** Initiatives that can receive new requests: active, not archived, in an available program. */
export const availableInitiativeWhere = {
  archivedAt: null,
  isActive: true,
  program: availableProgramWhere,
} satisfies Prisma.InitiativeWhereInput;

function authorize(actor: Pick<Actor, "role">, action: Action) {
  if (!can(actor.role, action)) throw new ForbiddenError(action);
}

export type TaxonomyInitiative = { id: string; number: number; name: string; sourceNote: string | null; objectives: number[] };

export type TaxonomyProgram = {
  id: string;
  number: number;
  name: string;
  officialName: string | null;
  goals: { number: number; text: string }[];
  initiatives: TaxonomyInitiative[];
};

export type Taxonomy = {
  objectives: { number: number; title: string }[];
  programs: TaxonomyProgram[];
  linkCount: number;
};

/**
 * Programs with goals, initiatives and objective links, in source order. Paused programs are left
 * out (derived availability) unless `includePaused` is set, as the extraction review does; archived
 * programs, goals and initiatives are always left out. Paused initiatives stay visible.
 */
export async function getTaxonomy(actor: Pick<Actor, "role">, options: { includePaused?: boolean } = {}): Promise<Taxonomy> {
  authorize(actor, "taxonomy.read");
  const [objectives, programs] = await Promise.all([
    db.strategicObjective.findMany({ where: { archivedAt: null }, orderBy: { number: "asc" }, select: { number: true, title: true } }),
    db.program.findMany({
      where: options.includePaused ? { archivedAt: null } : availableProgramWhere,
      orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        name: true,
        officialName: true,
        goals: { where: { archivedAt: null }, orderBy: { number: "asc" }, select: { number: true, text: true } },
        initiatives: {
          where: { archivedAt: null },
          orderBy: { number: "asc" },
          select: {
            id: true,
            number: true,
            name: true,
            sourceNote: true,
            objectiveLinks: { select: { objective: { select: { number: true } } } },
          },
        },
      },
    }),
  ]);

  let linkCount = 0;
  const shaped = programs.map((p) => ({
    ...p,
    initiatives: p.initiatives.map(({ objectiveLinks, ...i }) => {
      linkCount += objectiveLinks.length;
      return { ...i, objectives: objectiveLinks.map((l) => l.objective.number).sort((a, b) => a - b) };
    }),
  }));
  return { objectives, programs: shaped, linkCount };
}

export type ReviewInitiative = TaxonomyInitiative & {
  source: SourceInitiative | null;
  /** True when the stored name or links no longer equal the extraction (e.g. after an edit). */
  differsFromSource: boolean;
};

export type ReviewProgram = Omit<TaxonomyProgram, "initiatives"> & {
  sourcePage: number | null;
  numberingNote: string | null;
  initiatives: ReviewInitiative[];
};

export type UncertainCell = { program: number; initiative: number; objective: number; sourcePage: number };

export type TaxonomyReview = Omit<Taxonomy, "programs"> & {
  programs: ReviewProgram[];
  uncertainCells: UncertainCell[];
  /** Source initiatives with no matching database record (program number, initiative number). */
  missing: { program: number; initiative: number; name: string }[];
  /** Number of objective cells that were read (initiatives x 7). */
  cellsRead: number;
};

const sameSet = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

/** The extraction review: database contents side by side with the source pages. Super admin only. */
export async function getTaxonomyReview(actor: Pick<Actor, "role">): Promise<TaxonomyReview> {
  authorize(actor, "admin.access");
  const taxonomy = await getTaxonomy(actor, { includePaused: true });
  const sourceByNumber = new Map(TAXONOMY_SOURCE.programs.map((p) => [p.number, p]));

  const programs = taxonomy.programs.map((p) => {
    const sp = sourceByNumber.get(p.number);
    const sourceInitiatives = new Map(sp?.initiatives.map((i) => [i.number, i]));
    return {
      ...p,
      sourcePage: sp?.sourcePage ?? null,
      numberingNote: sp?.numberingNote ?? null,
      initiatives: p.initiatives.map((i) => {
        const source = sourceInitiatives.get(i.number) ?? null;
        const differsFromSource = !source || source.name !== i.name || !sameSet([...source.objectives].sort((a, b) => a - b), i.objectives);
        return { ...i, source, differsFromSource };
      }),
    };
  });

  const stored = new Set(programs.flatMap((p) => p.initiatives.map((i) => `${p.number}-${i.number}`)));
  const missing = TAXONOMY_SOURCE.programs.flatMap((p) =>
    p.initiatives.filter((i) => !stored.has(`${p.number}-${i.number}`)).map((i) => ({ program: p.number, initiative: i.number, name: i.name })),
  );
  const uncertainCells = TAXONOMY_SOURCE.programs.flatMap((p) =>
    p.initiatives.flatMap((i) =>
      i.uncertainObjectives.map((objective) => ({ program: p.number, initiative: i.number, objective, sourcePage: i.sourcePage })),
    ),
  );
  const cellsRead = TAXONOMY_SOURCE.programs.reduce((sum, p) => sum + p.initiatives.length * 7, 0);

  return { ...taxonomy, programs, uncertainCells, missing, cellsRead };
}
