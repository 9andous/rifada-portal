// Query scopers: every read of scoped data goes through one of these so visibility is decided
// in one place, on the server. They return Prisma `where` fragments.

import type { Prisma } from "@/generated/prisma/client";
import { scopeFor, type Action } from "./permissions";
import type { Role } from "./roles";

export type Actor = {
  id: string;
  role: Role;
  associationId: string | null;
  /** Program ids the supervisor is assigned to. Empty for other roles. */
  programIds: readonly string[];
};

/** Matches nothing. Used when an action is denied so callers can still run a safe query. */
const NONE = { id: { in: [] as string[] } };

export class ForbiddenError extends Error {
  constructor(action: string) {
    super(`Forbidden: ${action}`);
    this.name = "ForbiddenError";
  }
}

/**
 * Requests that have been submitted at least once. Drafts are private to their association
 * (change 19): staff scopes always include this, so no staff read path can reach a draft.
 */
export const SUBMITTED_ONLY = { referenceNo: { not: null } } satisfies Prisma.RequestWhereInput;

export function scopeRequests(actor: Actor, action: Action = "requests.read"): Prisma.RequestWhereInput {
  switch (scopeFor(actor.role, action)) {
    case "all":
      return { ...SUBMITTED_ONLY };
    case "programs":
      return { ...SUBMITTED_ONLY, programId: { in: [...actor.programIds] } };
    case "own":
      return actor.associationId ? { associationId: actor.associationId } : NONE;
    default:
      return NONE;
  }
}

export function scopeAssociations(actor: Actor): Prisma.AssociationWhereInput {
  switch (scopeFor(actor.role, "associations.read")) {
    case "all":
      return {};
    case "programs":
      return { requests: { some: { ...SUBMITTED_ONLY, programId: { in: [...actor.programIds] } } } };
    case "own":
      return actor.associationId ? { id: actor.associationId } : NONE;
    default:
      return NONE;
  }
}

/**
 * Comments visible to the actor. Internal notes are removed for anyone without
 * `comments.readInternal`, which always includes association officers.
 */
export function scopeComments(actor: Actor): Prisma.CommentWhereInput {
  const where: Prisma.CommentWhereInput = { request: scopeRequests(actor) };
  if (scopeFor(actor.role, "comments.readInternal") === null) where.isInternal = false;
  return where;
}
