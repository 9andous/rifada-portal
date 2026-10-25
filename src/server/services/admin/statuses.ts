import "server-only";
import type { Prisma, Role } from "@/generated/prisma/client";
import { statusTone, validateLifecycle, type LifecycleTransition, type TransitionRole } from "@/lib/workflow";
import type { StatusTone } from "@/components/ui/surface";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { assertCan, lockAdminWrites, refuse, type Result } from "./common";

// Request statuses and transitions (Phase 2b stop 2). The seven system statuses are renamed,
// recoloured and reordered only: no create, no delete, and the key and terminal flag never change
// (D-060). Every transition change is validated against the whole lifecycle before it is saved.

type Tx = Prisma.TransactionClient;

export type StatusRow = { id: string; key: string; name: string; tone: StatusTone; isTerminal: boolean; sortOrder: number };
export type TransitionRow = {
  id: string;
  fromStatusId: string;
  toStatusId: string;
  fromKey: string;
  toKey: string;
  allowedRoles: Role[];
  isAutomatic: boolean;
};

async function readLifecycle(client: Tx | typeof db) {
  const [statuses, transitions] = await Promise.all([
    client.requestStatus.findMany({ orderBy: [{ sortOrder: "asc" }, { key: "asc" }] }),
    client.statusTransition.findMany({ include: { fromStatus: { select: { key: true, sortOrder: true } }, toStatus: { select: { key: true, sortOrder: true } } } }),
  ]);
  return {
    statuses: statuses.map((s) => ({ id: s.id, key: s.key, name: s.name, tone: statusTone(s.colorToken), isTerminal: s.isTerminal, sortOrder: s.sortOrder })),
    transitions: transitions
      .sort((a, b) => a.fromStatus.sortOrder - b.fromStatus.sortOrder || a.toStatus.sortOrder - b.toStatus.sortOrder)
      .map((t) => ({
        id: t.id,
        fromStatusId: t.fromStatusId,
        toStatusId: t.toStatusId,
        fromKey: t.fromStatus.key,
        toKey: t.toStatus.key,
        allowedRoles: t.allowedRoles,
        isAutomatic: t.isAutomatic,
      })),
  };
}

export type Lifecycle = { statuses: StatusRow[]; transitions: TransitionRow[]; problems: string[] };

/** Statuses, transitions and any rule the stored lifecycle breaks (should be none). */
export async function getLifecycle(actor: Actor): Promise<Lifecycle> {
  assertCan(actor, "statuses.read");
  const lifecycle = await readLifecycle(db);
  return { ...lifecycle, problems: validateLifecycle(lifecycle.statuses, lifecycle.transitions) };
}

const MSG = {
  notFound: "الحالة غير موجودة.",
  transitionNotFound: "الانتقال غير موجود.",
} as const;

const statusSnapshot = (s: { key: string; name: string; colorToken: string; sortOrder: number }) => ({
  key: s.key,
  name: s.name,
  tone: statusTone(s.colorToken),
  sortOrder: s.sortOrder,
});

/** Name and colour only; the key and the terminal flag are never accepted. */
export async function updateStatus(actor: Actor, id: string, input: { name: string; tone: StatusTone }): Promise<Result> {
  assertCan(actor, "settings.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.requestStatus.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    const other = await tx.requestStatus.findFirst({ where: { name: input.name, id: { not: id } }, select: { id: true } });
    if (other) return { ok: false, errors: { name: "هذا الاسم مستخدم لحالة أخرى." } };
    const updated = await tx.requestStatus.update({ where: { id }, data: { name: input.name, colorToken: input.tone } });
    const before = statusSnapshot(current);
    const after = statusSnapshot(updated);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await audit({ actorId: actor.id, action: "status.updated", entityType: "RequestStatus", entityId: id, before, after }, tx);
    }
    return { ok: true };
  });
}

/** Swaps the display order with the neighbour. */
export async function moveStatus(actor: Actor, id: string, direction: "up" | "down"): Promise<Result> {
  assertCan(actor, "settings.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const all = await tx.requestStatus.findMany({ orderBy: [{ sortOrder: "asc" }, { key: "asc" }], select: { id: true, key: true } });
    const index = all.findIndex((s) => s.id === id);
    if (index < 0) return refuse(MSG.notFound);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= all.length) return { ok: true };
    const reordered = [...all];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    for (const [i, s] of reordered.entries()) await tx.requestStatus.update({ where: { id: s.id }, data: { sortOrder: i + 1 } });
    await audit(
      {
        actorId: actor.id,
        action: "status.reordered",
        entityType: "RequestStatus",
        entityId: id,
        before: { order: all.map((s) => s.key) },
        after: { order: reordered.map((s) => s.key) },
      },
      tx,
    );
    return { ok: true };
  });
}

export type TransitionInput = { fromStatusId: string; toStatusId: string; roles: TransitionRole[]; isAutomatic: boolean };

const transitionSnapshot = (t: Pick<TransitionRow, "fromKey" | "toKey" | "allowedRoles" | "isAutomatic">) => ({
  from: t.fromKey,
  to: t.toKey,
  roles: [...t.allowedRoles].sort(),
  isAutomatic: t.isAutomatic,
});

/** Applies a change to the in-memory lifecycle and refuses it when any rule would break. */
async function checkedLifecycle(tx: Tx, change: (transitions: LifecycleTransition[]) => LifecycleTransition[]): Promise<Result> {
  const { statuses, transitions } = await readLifecycle(tx);
  const problems = validateLifecycle(statuses, change(transitions));
  return problems.length > 0 ? { ok: false, message: problems.join(" ") } : { ok: true };
}

function normalise(input: TransitionInput): TransitionInput {
  return { ...input, roles: input.isAutomatic ? [] : [...new Set(input.roles)] };
}

export async function createTransition(actor: Actor, raw: TransitionInput): Promise<Result<{ id: string }>> {
  assertCan(actor, "settings.manage");
  const input = normalise(raw);
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const check = await checkedLifecycle(tx, (list) => [
      ...list,
      { fromStatusId: input.fromStatusId, toStatusId: input.toStatusId, allowedRoles: input.roles, isAutomatic: input.isAutomatic },
    ]);
    if (!check.ok) return check;
    const created = await tx.statusTransition.create({
      data: { fromStatusId: input.fromStatusId, toStatusId: input.toStatusId, allowedRoles: input.roles, isAutomatic: input.isAutomatic },
      include: { fromStatus: { select: { key: true } }, toStatus: { select: { key: true } } },
    });
    await audit(
      {
        actorId: actor.id,
        action: "transition.created",
        entityType: "StatusTransition",
        entityId: created.id,
        after: transitionSnapshot({ fromKey: created.fromStatus.key, toKey: created.toStatus.key, allowedRoles: created.allowedRoles, isAutomatic: created.isAutomatic }),
      },
      tx,
    );
    return { ok: true, id: created.id };
  });
}

/** Roles and the automatic flag may change; the two statuses of a transition do not (remove and add instead). */
export async function updateTransition(actor: Actor, id: string, raw: Pick<TransitionInput, "roles" | "isAutomatic">): Promise<Result> {
  assertCan(actor, "settings.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const current = await tx.statusTransition.findUnique({ where: { id }, include: { fromStatus: { select: { key: true } }, toStatus: { select: { key: true } } } });
    if (!current) return refuse(MSG.transitionNotFound);
    const input = normalise({ fromStatusId: current.fromStatusId, toStatusId: current.toStatusId, ...raw });
    const check = await checkedLifecycle(tx, (list) => list.map((t) => (t.id === id ? { ...t, allowedRoles: input.roles, isAutomatic: input.isAutomatic } : t)));
    if (!check.ok) return check;
    const updated = await tx.statusTransition.update({ where: { id }, data: { allowedRoles: input.roles, isAutomatic: input.isAutomatic } });
    const before = transitionSnapshot({ fromKey: current.fromStatus.key, toKey: current.toStatus.key, allowedRoles: current.allowedRoles, isAutomatic: current.isAutomatic });
    const after = transitionSnapshot({ fromKey: current.fromStatus.key, toKey: current.toStatus.key, allowedRoles: updated.allowedRoles, isAutomatic: updated.isAutomatic });
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await audit({ actorId: actor.id, action: "transition.updated", entityType: "StatusTransition", entityId: id, before, after }, tx);
    }
    return { ok: true };
  });
}

/**
 * Removes a transition (a rule between two statuses, not a status). Refused when the remaining
 * lifecycle would break a rule, e.g. leave a status that can no longer reach a terminal one.
 */
export async function removeTransition(actor: Actor, id: string): Promise<Result> {
  assertCan(actor, "settings.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const current = await tx.statusTransition.findUnique({ where: { id }, include: { fromStatus: { select: { key: true } }, toStatus: { select: { key: true } } } });
    if (!current) return refuse(MSG.transitionNotFound);
    const check = await checkedLifecycle(tx, (list) => list.filter((t) => t.id !== id));
    if (!check.ok) return check;
    await tx.statusTransition.delete({ where: { id } });
    await audit(
      {
        actorId: actor.id,
        action: "transition.removed",
        entityType: "StatusTransition",
        entityId: id,
        before: transitionSnapshot({ fromKey: current.fromStatus.key, toKey: current.toStatus.key, allowedRoles: current.allowedRoles, isAutomatic: current.isAutomatic }),
      },
      tx,
    );
    return { ok: true };
  });
}
