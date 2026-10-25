// The Phase 1b extraction of the strategy outline (private PDF) (prisma/seed/taxonomy.json): what the seed
// loads and what the review page compares the database against.

import source from "../../prisma/seed/taxonomy.json";

export type SourceInitiative = {
  number: number;
  name: string;
  /** PDF page of the initiatives table that lists this initiative. */
  sourcePage: number;
  /** Strategic objective numbers (1–7) checked in the source table. */
  objectives: number[];
  /** Original wording, present only when an obvious spacing typo was fixed. */
  sourceText?: string;
  /** Source rows merged into this one initiative (accepted default for program 1, initiative 2). */
  mergedRows?: string[];
  sourceNote?: string;
  /** Objective cells the two readings did not agree on or could not read with certainty. */
  uncertainObjectives: number[];
};

export type SourceProgram = {
  number: number;
  name: string;
  officialName?: string;
  sourcePage: number;
  numberingNote?: string;
  goals: string[];
  initiatives: SourceInitiative[];
};

export type TaxonomySource = { source: string; programs: SourceProgram[] };

export const TAXONOMY_SOURCE = source as TaxonomySource;

export const OBJECTIVE_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;
