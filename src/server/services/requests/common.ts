import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { RequirementSpec } from "@/lib/requests";
import { canTriggerTransition, type SystemStatusKey } from "@/lib/workflow";
import type { Role } from "@/server/authz/roles";
import { db } from "@/server/db";

// Shared pieces of the request services (Phase 3).

export type Tx = Prisma.TransactionClient;
export type Client = Tx | typeof db;

export type StatusRef = { id: string; key: SystemStatusKey; name: string; colorToken: string; isTerminal: boolean };

/** The seven statuses by key. Statuses are data with stable keys (D-013); missing ones are a setup error. */
export async function statusMap(client: Client = db): Promise<Record<SystemStatusKey, StatusRef>> {
  const rows = await client.requestStatus.findMany({ select: { id: true, key: true, name: true, colorToken: true, isTerminal: true } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r])) as Record<SystemStatusKey, StatusRef>;
  for (const key of ["DRAFT", "SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW", "RETURNED", "APPROVED", "REJECTED"] as const) {
    if (!map[key]) throw new Error(`Request status ${key} is not seeded`);
  }
  return map;
}

export async function statusIds(keys: readonly SystemStatusKey[], client: Client = db): Promise<string[]> {
  const map = await statusMap(client);
  return keys.map((k) => map[k].id);
}

/**
 * Whether the lifecycle data allows a move: by a user of `by` role (manual transitions only), or by
 * the system (automatic transitions only). The status editor can remove transitions (D-060), so
 * every workflow step asks the data instead of assuming the default lifecycle.
 */
export async function transitionAllowed(client: Client, fromId: string, toId: string, by: Role | "system"): Promise<boolean> {
  const t = await client.statusTransition.findUnique({
    where: { fromStatusId_toStatusId: { fromStatusId: fromId, toStatusId: toId } },
    select: { allowedRoles: true, isAutomatic: true },
  });
  if (!t) return false;
  return by === "system" ? t.isAutomatic : canTriggerTransition(t, by);
}

export const LIFECYCLE_BLOCKED = "دورة حياة الطلب لا تسمح بهذا الإجراء حاليًا؛ تواصل مع إدارة المنصة.";

/** Thrown inside a transaction to roll it back with an Arabic message for the user. */
export class WorkflowRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowRefusal";
  }
}

const requirementSelect = {
  key: true,
  label: true,
  kind: true,
  fieldType: true,
  options: true,
  isRequired: true,
  sortOrder: true,
  attachmentType: { select: { key: true, name: true, allowedMimeGroups: true } },
} satisfies Prisma.InitiativeRequirementSelect;

/** The initiative's requirements as they stand now, in the snapshot shape (D-077). */
export async function liveRequirements(client: Client, initiativeId: string): Promise<RequirementSpec[]> {
  const rows = await client.initiativeRequirement.findMany({
    where: { initiativeId },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { key: "asc" }],
    select: requirementSelect,
  });
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    kind: r.kind,
    fieldType: r.fieldType,
    options: Array.isArray(r.options) ? (r.options as string[]) : [],
    isRequired: r.isRequired,
    sortOrder: r.sortOrder,
    attachmentType: r.attachmentType ? { key: r.attachmentType.key, name: r.attachmentType.name, groups: r.attachmentType.allowedMimeGroups } : null,
  }));
}

/** The users who act for an association: its active officer account. */
export async function associationRecipients(client: Client, associationId: string): Promise<string[]> {
  const users = await client.user.findMany({ where: { associationId, isActive: true, role: "ASSOCIATION_OFFICER" }, select: { id: true } });
  return users.map((u) => u.id);
}

export async function activeManagerIds(client: Client): Promise<string[]> {
  const users = await client.user.findMany({ where: { role: "UNIT_MANAGER", isActive: true }, select: { id: true } });
  return users.map((u) => u.id);
}

/** Audit snapshot fragment identifying a request (no content). */
export const requestRef = (r: { referenceNo: string | null; title: string }) => ({ referenceNo: r.referenceNo, title: r.title });
