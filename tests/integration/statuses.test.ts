import { beforeEach, describe, expect, it } from "vitest";
import { seedStatuses } from "../../prisma/seed/statuses";
import type { Role } from "@/server/authz/roles";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import { createTransition, getLifecycle, moveStatus, removeTransition, updateStatus, updateTransition } from "@/server/services/admin/statuses";
import { makeRoleActors } from "../support/admin";
import { db, resetDatabase } from "../support/db";

let actors: Awaited<ReturnType<typeof makeRoleActors>>["actors"];
let admin: Actor;
let ids: Record<string, string>;

async function transitionId(from: string, to: string) {
  const t = await db.statusTransition.findFirstOrThrow({ where: { fromStatusId: ids[from], toStatusId: ids[to] } });
  return t.id;
}

beforeEach(async () => {
  await resetDatabase();
  await seedStatuses(db);
  ids = Object.fromEntries((await db.requestStatus.findMany()).map((s) => [s.key, s.id]));
  ({ actors } = await makeRoleActors());
  admin = actors.SUPER_ADMIN;
});

describe("default lifecycle seed", () => {
  it("seeds the seven statuses and eight transitions, three of them automatic, and is idempotent", async () => {
    await seedStatuses(db);
    const lifecycle = await getLifecycle(admin);
    expect(lifecycle.statuses.map((s) => s.key)).toEqual(["DRAFT", "SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW", "RETURNED", "APPROVED", "REJECTED"]);
    expect(lifecycle.transitions).toHaveLength(8);
    expect(lifecycle.transitions.filter((t) => t.isAutomatic).map((t) => `${t.fromKey}>${t.toKey}`).sort()).toEqual([
      "COMPLETENESS_CHECK>DRAFT",
      "COMPLETENESS_CHECK>UNDER_REVIEW",
      "SUBMITTED>COMPLETENESS_CHECK",
    ]);
    expect(lifecycle.problems).toEqual([]);
    const review = lifecycle.transitions.filter((t) => t.fromKey === "UNDER_REVIEW").map((t) => [t.toKey, [...t.allowedRoles].sort()]);
    expect(review).toEqual(expect.arrayContaining([["RETURNED", ["SUPERVISOR", "UNIT_MANAGER"]], ["APPROVED", ["SUPERVISOR", "UNIT_MANAGER"]], ["REJECTED", ["SUPERVISOR", "UNIT_MANAGER"]]]));
  });

  it("flags pre-existing role-less rows as automatic once, and never overwrites an admin's edit", async () => {
    const auto = await transitionId("SUBMITTED", "COMPLETENESS_CHECK");
    await db.statusTransition.update({ where: { id: auto }, data: { isAutomatic: false } }); // as before the migration
    const edited = await transitionId("COMPLETENESS_CHECK", "DRAFT");
    await db.statusTransition.update({ where: { id: edited }, data: { isAutomatic: false, allowedRoles: ["UNIT_MANAGER"] } });
    await seedStatuses(db);
    expect((await db.statusTransition.findUniqueOrThrow({ where: { id: auto } })).isAutomatic).toBe(true);
    expect(await db.statusTransition.findUniqueOrThrow({ where: { id: edited } })).toMatchObject({ isAutomatic: false, allowedRoles: ["UNIT_MANAGER"] });
  });
});

describe("statuses: permissions", () => {
  it("lets the super admin and the unit manager read; only the super admin writes", async () => {
    expect((await getLifecycle(actors.UNIT_MANAGER)).statuses).toHaveLength(7);
    for (const role of ["SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      await expect(getLifecycle(actors[role]), role).rejects.toBeInstanceOf(ForbiddenError);
    }
    const t = await transitionId("DRAFT", "SUBMITTED");
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      const a = actors[role];
      const calls: (() => Promise<unknown>)[] = [
        () => updateStatus(a, ids.DRAFT, { name: "اسم", tone: "info" }),
        () => moveStatus(a, ids.DRAFT, "down"),
        () => createTransition(a, { fromStatusId: ids.RETURNED, toStatusId: ids.REJECTED, roles: ["UNIT_MANAGER"], isAutomatic: false }),
        () => updateTransition(a, t, { roles: ["UNIT_MANAGER"], isAutomatic: false }),
        () => removeTransition(a, t),
      ];
      for (const call of calls) await expect(call(), role).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.auditLog.count()).toBe(0);
  });
});

describe("statuses: rename, recolour, reorder", () => {
  it("changes name and colour only, keeps key and terminal flag, and audits", async () => {
    expect((await updateStatus(admin, ids.APPROVED, { name: "مقبول", tone: "info" })).ok).toBe(true);
    expect(await db.requestStatus.findUniqueOrThrow({ where: { id: ids.APPROVED } })).toMatchObject({ key: "APPROVED", name: "مقبول", colorToken: "info", isTerminal: true });
    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "status.updated" } });
    expect(entry.before).toMatchObject({ key: "APPROVED", name: "معتمد", tone: "ok" });
    expect(entry.after).toMatchObject({ key: "APPROVED", name: "مقبول", tone: "info" });
    expect(await updateStatus(admin, ids.REJECTED, { name: "مقبول", tone: "bad" })).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
  });

  it("reorders with up/down and audits the order", async () => {
    await moveStatus(admin, ids.RETURNED, "up");
    const lifecycle = await getLifecycle(admin);
    expect(lifecycle.statuses.map((s) => s.key)).toEqual(["DRAFT", "SUBMITTED", "COMPLETENESS_CHECK", "RETURNED", "UNDER_REVIEW", "APPROVED", "REJECTED"]);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "status.reordered" } })).after).toMatchObject({ order: lifecycle.statuses.map((s) => s.key) });
  });

  it("never deletes a status (no service path; counts unchanged after every edit)", async () => {
    await updateStatus(admin, ids.DRAFT, { name: "مسودة الطلب", tone: "neutral" });
    await moveStatus(admin, ids.DRAFT, "down");
    expect(await db.requestStatus.count()).toBe(7);
  });
});

describe("transitions", () => {
  it("adds a valid transition with audit", async () => {
    const result = await createTransition(admin, { fromStatusId: ids.RETURNED, toStatusId: ids.REJECTED, roles: ["UNIT_MANAGER"], isAutomatic: false });
    expect(result.ok).toBe(true);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "transition.created" } })).after).toEqual({ from: "RETURNED", to: "REJECTED", roles: ["UNIT_MANAGER"], isAutomatic: false });
  });

  it("refuses leaving a terminal status, duplicates, self transitions and manual ones without roles", async () => {
    const cases = [
      { fromStatusId: ids.APPROVED, toStatusId: ids.UNDER_REVIEW, roles: ["UNIT_MANAGER" as const], isAutomatic: false },
      { fromStatusId: ids.DRAFT, toStatusId: ids.SUBMITTED, roles: ["ASSOCIATION_OFFICER" as const], isAutomatic: false },
      { fromStatusId: ids.UNDER_REVIEW, toStatusId: ids.UNDER_REVIEW, roles: ["UNIT_MANAGER" as const], isAutomatic: false },
      { fromStatusId: ids.RETURNED, toStatusId: ids.REJECTED, roles: [], isAutomatic: false },
    ];
    for (const c of cases) expect((await createTransition(admin, c)).ok, JSON.stringify(c)).toBe(false);
    expect(await db.statusTransition.count()).toBe(8);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("refuses the super admin as a role", async () => {
    const result = await createTransition(admin, { fromStatusId: ids.RETURNED, toStatusId: ids.REJECTED, roles: ["SUPER_ADMIN" as never], isAutomatic: false });
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("مدير النظام") });
  });

  it("drops roles from automatic transitions and can switch a transition between manual and automatic", async () => {
    const created = await createTransition(admin, { fromStatusId: ids.RETURNED, toStatusId: ids.REJECTED, roles: ["UNIT_MANAGER"], isAutomatic: true });
    if (!created.ok) throw new Error(created.message);
    expect(await db.statusTransition.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ isAutomatic: true, allowedRoles: [] });
    expect((await updateTransition(admin, created.id, { roles: ["UNIT_MANAGER"], isAutomatic: false })).ok).toBe(true);
    expect(await db.statusTransition.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ isAutomatic: false, allowedRoles: ["UNIT_MANAGER"] });
    expect(await updateTransition(admin, created.id, { roles: [], isAutomatic: false })).toMatchObject({ ok: false });
    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "transition.updated" } });
    expect(entry.before).toMatchObject({ isAutomatic: true, roles: [] });
    expect(entry.after).toMatchObject({ isAutomatic: false, roles: ["UNIT_MANAGER"] });
  });

  it("refuses removing a transition that would strand a status, and removes a redundant one with audit", async () => {
    const lifeline = await transitionId("RETURNED", "SUBMITTED");
    expect(await removeTransition(admin, lifeline)).toMatchObject({ ok: false, message: expect.stringContaining("حالة نهائية") });
    expect(await db.statusTransition.count()).toBe(8);

    const extra = await createTransition(admin, { fromStatusId: ids.RETURNED, toStatusId: ids.REJECTED, roles: ["UNIT_MANAGER"], isAutomatic: false });
    if (!extra.ok) throw new Error("expected ok");
    expect((await removeTransition(admin, extra.id)).ok).toBe(true);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "transition.removed" } })).before).toMatchObject({ from: "RETURNED", to: "REJECTED" });
    expect(await db.requestStatus.count()).toBe(7);
  });
});
