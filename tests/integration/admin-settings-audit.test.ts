import { beforeEach, describe, expect, it } from "vitest";
import type { Role } from "@/server/authz/roles";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import { auditFigures, auditFilterOptions, listAuditLog, parseAuditListParams } from "@/server/services/admin/audit-log";
import { getSettingsView, updateSettings } from "@/server/services/admin/settings";
import { getSetting } from "@/server/settings/read";
import { SETTING_DEFAULTS } from "@/server/settings/defaults";
import { makeRoleActors } from "../support/admin";
import { db, resetDatabase } from "../support/db";

let ctx: Awaited<ReturnType<typeof makeRoleActors>>;
let admin: Actor;

const valid = {
  "sla.workingDays": 3,
  "uploads.maxFileMb": 25,
  "uploads.allowedGroups": ["pdf", "word", "excel", "image"],
  "uploads.associationQuotaMb": 2048,
  "bulk.maxItems": 25,
  "public.showInitiatives": false,
};

async function seedSettings() {
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) await db.setting.create({ data: { key, value } });
}

beforeEach(async () => {
  await resetDatabase();
  ctx = await makeRoleActors();
  admin = ctx.actors.SUPER_ADMIN;
  await seedSettings();
});

describe("settings", () => {
  it("are readable and writable by the super admin only", async () => {
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      await expect(getSettingsView(ctx.actors[role]), role).rejects.toBeInstanceOf(ForbiddenError);
      await expect(updateSettings(ctx.actors[role], valid), role).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect((await getSettingsView(admin)).values).toEqual(valid);
  });

  it("rejects invalid values without writing or auditing anything", async () => {
    const result = await updateSettings(admin, { ...valid, "sla.workingDays": 0, "uploads.allowedGroups": ["video"] });
    expect(result).toMatchObject({ ok: false, errors: { "sla.workingDays": expect.any(String), "uploads.allowedGroups": expect.any(String) } });
    expect(await getSetting("sla.workingDays")).toBe(3);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("writes and audits only the keys that changed, with before and after", async () => {
    const result = await updateSettings(admin, { ...valid, "sla.workingDays": 10, "public.showInitiatives": true });
    expect(result).toEqual({ ok: true, changed: ["sla.workingDays", "public.showInitiatives"] });
    expect(await getSetting("sla.workingDays")).toBe(10);
    expect(await getSetting("public.showInitiatives")).toBe(true);
    expect((await db.setting.findUniqueOrThrow({ where: { key: "sla.workingDays" } })).updatedById).toBe(admin.id);

    const entries = await db.auditLog.findMany({ where: { action: "setting.updated" }, orderBy: { entityId: "asc" } });
    expect(entries.map((e) => [e.entityId, e.before, e.after])).toEqual([
      ["public.showInitiatives", { key: "public.showInitiatives", value: false }, { key: "public.showInitiatives", value: true }],
      ["sla.workingDays", { key: "sla.workingDays", value: 3 }, { key: "sla.workingDays", value: 10 }],
    ]);

    expect(await updateSettings(admin, { ...valid, "sla.workingDays": 10, "public.showInitiatives": true })).toEqual({ ok: true, changed: [] });
    expect(await db.auditLog.count()).toBe(2);
  });

  it("stores upload groups in a stable order and shows who changed a setting", async () => {
    await updateSettings(admin, { ...valid, "uploads.allowedGroups": ["image", "pdf"] });
    expect(await getSetting("uploads.allowedGroups")).toEqual(["pdf", "image"]);
    const view = await getSettingsView(admin);
    expect(view.meta["uploads.allowedGroups"].updatedBy).toBe(ctx.users.admin.name);
    expect(view.meta["sla.workingDays"].updatedBy).toBeNull();
  });

  it("falls back to defaults when a stored value is malformed", async () => {
    await db.setting.update({ where: { key: "bulk.maxItems" }, data: { value: "many" } });
    expect((await getSettingsView(admin)).values["bulk.maxItems"]).toBe(25);
  });
});

describe("audit log viewer", () => {
  async function entry(action: string, entityType: string, createdAt: string, actorId: string | null = admin.id) {
    await db.auditLog.create({ data: { action, entityType, actorId, createdAt: new Date(createdAt) } });
  }

  beforeEach(async () => {
    await entry("user.created", "User", "2026-10-20T08:00:00Z");
    await entry("user.updated", "User", "2026-10-22T20:30:00Z"); // 22 Oct, 23:30 in Riyadh
    await entry("setting.updated", "Setting", "2026-10-22T21:30:00Z"); // 23 Oct, 00:30 in Riyadh
    await entry("auth.password_reset_requested", "User", "2026-10-23T10:00:00Z", null);
    await entry("user.created", "User", "2026-10-23T11:00:00Z", ctx.users.manager.id);
  });

  it("is readable by the super admin only", async () => {
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      await expect(listAuditLog(ctx.actors[role], parseAuditListParams({})), role).rejects.toBeInstanceOf(ForbiddenError);
      await expect(auditFilterOptions(ctx.actors[role]), role).rejects.toBeInstanceOf(ForbiddenError);
      await expect(auditFigures(ctx.actors[role]), role).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("lists newest first and filters by actor, action, entity and Riyadh date range", async () => {
    const all = await listAuditLog(admin, parseAuditListParams({}));
    expect(all.total).toBe(5);
    expect(all.items[0].createdAt.toISOString()).toBe("2026-10-23T11:00:00.000Z");
    expect((await listAuditLog(admin, parseAuditListParams({ dir: "asc" }))).items[0].action).toBe("user.created");

    expect((await listAuditLog(admin, parseAuditListParams({ actor: ctx.users.manager.id }))).total).toBe(1);
    expect((await listAuditLog(admin, parseAuditListParams({ actor: "system" }))).items[0].action).toBe("auth.password_reset_requested");
    expect((await listAuditLog(admin, parseAuditListParams({ action: "user.created" }))).total).toBe(2);
    expect((await listAuditLog(admin, parseAuditListParams({ entity: "Setting" }))).total).toBe(1);

    const day = await listAuditLog(admin, parseAuditListParams({ from: "2026-10-22", to: "2026-10-22" }));
    expect(day.items.map((i) => i.action)).toEqual(["user.updated"]);
    const range = await listAuditLog(admin, parseAuditListParams({ from: "2026-10-23" }));
    expect(range.total).toBe(3);
    expect((await listAuditLog(admin, parseAuditListParams({ from: "not-a-date" }))).total).toBe(5);
  });

  it("offers filter values from the log itself", async () => {
    const options = await auditFilterOptions(admin);
    expect(options.actions).toEqual(["auth.password_reset_requested", "setting.updated", "user.created", "user.updated"]);
    expect(options.entities).toEqual(["Setting", "User"]);
    expect(options.actors.map((a) => a.id).sort()).toEqual([admin.id, ctx.users.manager.id].sort());
    expect(await auditFigures(admin, new Date("2026-10-23T12:00:00Z"))).toEqual({ total: 5, lastDay: 4, actors: 2 });
  });
});
