// Shared pieces of the admin services: result shape, guards and the admin write lock.

import type { Prisma } from "@/generated/prisma/client";
import type { FieldErrors } from "@/lib/validation/auth";
import { can, type Action } from "@/server/authz/permissions";
import { ForbiddenError, type Actor } from "@/server/authz/scope";

/** A refused change: a form-level message and/or per-field messages, all in Arabic. */
export type Refusal = { ok: false; message?: string; errors?: FieldErrors };
export type Result<T extends object = object> = ({ ok: true } & T) | Refusal;

export function refuse(message: string, errors?: FieldErrors): Refusal {
  return { ok: false, message, errors };
}

export function fieldRefusal(field: string, message: string): Refusal {
  return { ok: false, errors: { [field]: message } };
}

export function assertCan(actor: Actor, action: Action): void {
  if (!can(actor.role, action)) throw new ForbiddenError(action);
}

// One fixed key: account and association changes are rare, so serialising them is cheap and makes
// the "last active super admin" and "one officer per association" checks race-free.
const ADMIN_LOCK_KEY = 72_026_001;

export async function lockAdminWrites(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK_KEY}::bigint)`;
}

export const PAGE_SIZE = 20;

/** Case-insensitive "contains" on several columns, for the search box. */
export function containsAny<K extends string>(q: string, fields: readonly K[]) {
  return fields.map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } }) as Record<K, { contains: string; mode: "insensitive" }>);
}
