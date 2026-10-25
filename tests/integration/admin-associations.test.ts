import { beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "@/server/auth/password";
import type { Role } from "@/server/authz/roles";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import {
  associationFigures,
  associationRegions,
  createAssociation,
  createAssociationOfficer,
  getAssociationDetail,
  listAssociations,
  parseAssociationListParams,
  setAssociationActive,
  updateAssociation,
} from "@/server/services/admin/associations";
import { associationInput, makeAssociation, makeRoleActors } from "../support/admin";
import { db, resetDatabase } from "../support/db";

let ctx: Awaited<ReturnType<typeof makeRoleActors>>;
let admin: Actor;
const officerInput = (username: string) => ({ username, name: "فهد السالم", email: null, phone: null });

beforeEach(async () => {
  await resetDatabase();
  ctx = await makeRoleActors();
  admin = ctx.actors.SUPER_ADMIN;
});

describe("associations: permissions", () => {
  it("gives the unit manager read-only access and denies every write", async () => {
    const manager = ctx.actors.UNIT_MANAGER;
    const list = await listAssociations(manager, parseAssociationListParams({}));
    expect(list.items.map((a) => a.id)).toEqual([ctx.association.id]);
    expect((await getAssociationDetail(manager, ctx.association.id))?.name).toBe("جمعية المسؤول");
    expect((await associationFigures(manager)).total).toBe(1);

    await expect(createAssociation(manager, associationInput(), null)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateAssociation(manager, ctx.association.id, associationInput())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setAssociationActive(manager, ctx.association.id, false)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.association.count()).toBe(1);
  });

  it("denies the registry and every write to supervisors and officers", async () => {
    for (const role of ["SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      const actor = ctx.actors[role];
      const calls: (() => Promise<unknown>)[] = [
        () => listAssociations(actor, parseAssociationListParams({})),
        () => associationFigures(actor),
        () => associationRegions(actor),
        () => getAssociationDetail(actor, ctx.association.id),
        () => createAssociation(actor, associationInput(), null),
        () => updateAssociation(actor, ctx.association.id, associationInput()),
        () => setAssociationActive(actor, ctx.association.id, false),
      ];
      for (const call of calls) await expect(call(), role).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("searches, filters, sorts and pages the registry", async () => {
    for (let i = 0; i < 21; i++) await makeAssociation(`جمعية البر ${String(i).padStart(2, "0")}`);
    await db.association.updateMany({ where: { name: { startsWith: "جمعية البر 0" } }, data: { region: "المدينة المنورة" } });
    const page1 = await listAssociations(admin, parseAssociationListParams({}));
    expect(page1.total).toBe(22);
    expect(page1.items).toHaveLength(20);
    const search = await listAssociations(admin, parseAssociationListParams({ q: "البر 1", sort: "name", dir: "desc" }));
    expect(search.items.map((a) => a.name)).toEqual(Array.from({ length: 10 }, (_, i) => `جمعية البر ${19 - i}`));
    expect((await listAssociations(admin, parseAssociationListParams({ officer: "with" }))).items.map((a) => a.id)).toEqual([ctx.association.id]);
    expect((await listAssociations(admin, parseAssociationListParams({ region: "المدينة المنورة" }))).total).toBe(10);
    expect(await associationRegions(admin)).toEqual(["المدينة المنورة"]);
  });
});

describe("associations: create and edit", () => {
  it("creates an association without an officer", async () => {
    const result = await createAssociation(admin, associationInput({ name: "جمعية هدية الحاج والمعتمر", licenseNumber: "1001" }), null);
    if (!result.ok) throw new Error(result.message);
    expect(result.officer).toBeNull();
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "association.created" } });
    expect(audit.after).toMatchObject({ name: "جمعية هدية الحاج والمعتمر", licenseNumber: "1001", isActive: true });
  });

  it("optionally creates the officer account in the same step, with a one-time password", async () => {
    const result = await createAssociation(admin, associationInput(), officerInput("officer.new"));
    if (!result.ok || !result.officer) throw new Error("expected an officer");
    const officer = await db.user.findUniqueOrThrow({ where: { username: "officer.new" }, include: { accounts: true } });
    expect(officer.associationId).toBe(result.associationId);
    expect(officer.role).toBe("ASSOCIATION_OFFICER");
    expect(officer.mustChangePassword).toBe(true);
    expect(await verifyPassword({ hash: officer.accounts[0].password!, password: result.officer.password })).toBe(true);
    expect((await db.auditLog.findMany({ orderBy: { createdAt: "asc" } })).map((a) => a.action)).toEqual(["association.created", "user.created"]);
    const text = JSON.stringify(await db.auditLog.findMany({ select: { before: true, after: true } }));
    expect(text).not.toContain(result.officer.password);
    expect(text).not.toMatch(/\$argon2/);
  });

  it("writes nothing when the officer username is taken", async () => {
    const result = await createAssociation(admin, associationInput(), officerInput(ctx.users.manager.username!));
    expect(result).toMatchObject({ ok: false, errors: { "officer.username": expect.any(String) } });
    expect(await db.association.count()).toBe(1);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("keeps license numbers unique when set, and allows many without one", async () => {
    expect((await createAssociation(admin, associationInput({ licenseNumber: "777" }), null)).ok).toBe(true);
    expect(await createAssociation(admin, associationInput({ licenseNumber: "777" }), null)).toMatchObject({
      ok: false,
      errors: { licenseNumber: expect.any(String) },
    });
    expect((await createAssociation(admin, associationInput(), null)).ok).toBe(true);
    expect((await createAssociation(admin, associationInput(), null)).ok).toBe(true);
    expect(await updateAssociation(admin, ctx.association.id, associationInput({ licenseNumber: "777" }))).toMatchObject({ ok: false });
  });

  it("audits edits with before and after, and skips no-op saves", async () => {
    const input = associationInput({ name: "جمعية المسؤول", city: "المدينة المنورة" });
    expect((await updateAssociation(admin, ctx.association.id, input)).ok).toBe(true);
    expect((await updateAssociation(admin, ctx.association.id, input)).ok).toBe(true);
    const entries = await db.auditLog.findMany({ where: { action: "association.updated" } });
    expect(entries).toHaveLength(1);
    expect(entries[0].before).toMatchObject({ city: null });
    expect(entries[0].after).toMatchObject({ city: "المدينة المنورة" });
  });
});

describe("associations: deactivation", () => {
  it("deactivates the officer with the association and ends their sessions; reactivation leaves the officer off", async () => {
    const officerId = ctx.users.officer.id;
    await db.session.create({ data: { userId: officerId, token: "officer-session", expiresAt: new Date(Date.now() + 3_600_000) } });

    const off = await setAssociationActive(admin, ctx.association.id, false);
    expect(off).toMatchObject({ ok: true, officerDeactivated: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: officerId } })).isActive).toBe(false);
    expect(await db.session.count({ where: { userId: officerId } })).toBe(0);

    const on = await setAssociationActive(admin, ctx.association.id, true);
    expect(on.ok).toBe(true);
    expect((await db.association.findUniqueOrThrow({ where: { id: ctx.association.id } })).isActive).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: officerId } })).isActive).toBe(false);

    const actions = (await db.auditLog.findMany({ orderBy: { createdAt: "asc" } })).map((a) => `${a.action}:${a.entityType}`);
    expect(actions).toEqual(["association.deactivated:Association", "user.deactivated:User", "association.reactivated:Association"]);
  });
});

describe("associations: «إنشاء حساب مسؤول» for an association without an officer", () => {
  it("creates the officer for that association with a one-time password that must be changed", async () => {
    const association = await makeAssociation("جمعية بلا مسؤول");
    const result = await createAssociationOfficer(admin, association.id, officerInput("later.officer"));
    if (!result.ok) throw new Error(result.message);

    const officer = await db.user.findUniqueOrThrow({ where: { id: result.userId }, include: { accounts: true } });
    expect(officer).toMatchObject({ username: "later.officer", role: "ASSOCIATION_OFFICER", associationId: association.id, mustChangePassword: true });
    expect(await verifyPassword({ hash: officer.accounts[0].password!, password: result.password })).toBe(true);

    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "user.created", entityId: officer.id } });
    expect(entry.after).toMatchObject({ associationId: association.id, role: "ASSOCIATION_OFFICER" });
    const text = JSON.stringify(await db.auditLog.findMany({ select: { before: true, after: true } }));
    expect(text).not.toContain(result.password);
    expect(text).not.toMatch(/\$argon2/);
  });

  it("refuses a second officer, an inactive association, a missing one and a taken username, writing nothing", async () => {
    expect(await createAssociationOfficer(admin, ctx.association.id, officerInput("second.officer"))).toMatchObject({
      ok: false,
      message: expect.stringContaining("حساب مسؤول"),
    });
    const inactive = await makeAssociation("جمعية معطلة", { isActive: false });
    expect(await createAssociationOfficer(admin, inactive.id, officerInput("inactive.officer"))).toMatchObject({ ok: false });
    expect(await createAssociationOfficer(admin, "missing-id", officerInput("missing.officer"))).toMatchObject({ ok: false });
    const free = await makeAssociation("جمعية متاحة");
    expect(await createAssociationOfficer(admin, free.id, officerInput(ctx.users.manager.username!))).toMatchObject({
      ok: false,
      errors: { "officer.username": expect.any(String) },
    });
    expect(await db.user.count()).toBe(4);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("is denied to every role except the super admin", async () => {
    const free = await makeAssociation("جمعية متاحة");
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      await expect(createAssociationOfficer(ctx.actors[role], free.id, officerInput(`x.${role.toLowerCase()}`)), role).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.user.count({ where: { associationId: free.id } })).toBe(0);
  });
});
