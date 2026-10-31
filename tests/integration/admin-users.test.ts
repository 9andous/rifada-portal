import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/server/auth/auth";
import { verifyPassword } from "@/server/auth/password";
import type { Role } from "@/server/authz/roles";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import {
  createUser,
  getUserDetail,
  listUsers,
  parseUserListParams,
  resetUserPassword,
  setUserActive,
  updateUser,
  userFigures,
  userFormOptions,
} from "@/server/services/admin/users";
import { actorOf, makeAssociation, makeRoleActors, makeUser, TEST_PASSWORD, userInput } from "../support/admin";
import { db, resetDatabase } from "../support/db";

const BASE = "http://localhost:3000";
let ip = 0;

function signIn(username: string, password: string) {
  ip += 1;
  return auth.handler(
    new Request(`${BASE}/api/auth/sign-in/username`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": `10.20.0.${ip}` },
      body: JSON.stringify({ username, password }),
    }),
  );
}

function cookieFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function getSession(cookie: string) {
  return auth.api.getSession({ headers: new Headers({ cookie }) });
}

/** Every audit row's before/after must be free of passwords and hashes. */
async function expectNoSecretsInAudit(...plaintexts: string[]) {
  const rows = await db.auditLog.findMany();
  const hashes = (await db.account.findMany({ select: { password: true } })).flatMap((a) => (a.password ? [a.password] : []));
  for (const row of rows) {
    const text = JSON.stringify([row.before, row.after]);
    expect(text).not.toMatch(/\$argon2/);
    expect(text).not.toMatch(/"(password|passwordHash|hash|token|secret)"/i);
    for (const secret of [...plaintexts, ...hashes]) expect(text).not.toContain(secret);
  }
}

let ctx: Awaited<ReturnType<typeof makeRoleActors>>;
let admin: Actor;

beforeEach(async () => {
  await resetDatabase();
  ctx = await makeRoleActors();
  admin = ctx.actors.SUPER_ADMIN;
});

describe("users: permissions", () => {
  it("denies every user-management read and write to the unit manager, supervisor and officer", async () => {
    const target = ctx.users.manager.id;
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      const actor = ctx.actors[role];
      const calls: (() => Promise<unknown>)[] = [
        () => listUsers(actor, parseUserListParams({})),
        () => userFigures(actor),
        () => userFormOptions(actor),
        () => getUserDetail(actor, target),
        () => createUser(actor, userInput()),
        () => updateUser(actor, target, userInput()),
        () => setUserActive(actor, target, false),
        () => resetUserPassword(actor, target),
      ];
      for (const call of calls) await expect(call(), role).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.user.count()).toBe(4);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("lets the super admin list, filter, sort and page users", async () => {
    for (let i = 0; i < 22; i++) await makeUser("SUPERVISOR", { username: `bulk.sup.${String(i).padStart(2, "0")}` });
    // The default tab lists the platform's team; the one association officer has its own tab.
    const all = await listUsers(admin, parseUserListParams({}));
    expect(all.total).toBe(25);
    expect(all.items).toHaveLength(20);
    expect(all.items.every((u) => u.role !== "ASSOCIATION_OFFICER")).toBe(true);
    expect(all.pageCount).toBe(2);
    const second = await listUsers(admin, parseUserListParams({ page: "2" }));
    expect(second.items).toHaveLength(5);

    const officers = await listUsers(admin, parseUserListParams({ tab: "officers" }));
    expect(officers.items.map((u) => u.role)).toEqual(["ASSOCIATION_OFFICER"]);
    // The role filter cannot pull officers into the team tab, nor staff into the officers tab.
    expect((await listUsers(admin, parseUserListParams({ role: "ASSOCIATION_OFFICER" }))).total).toBe(25);
    expect((await listUsers(admin, parseUserListParams({ tab: "officers", role: "SUPERVISOR" }))).total).toBe(1);

    const sup = await listUsers(admin, parseUserListParams({ role: "SUPERVISOR", q: "bulk.sup.0", sort: "username", dir: "desc" }));
    expect(sup.items.map((u) => u.username)).toEqual(Array.from({ length: 10 }, (_, i) => `bulk.sup.0${9 - i}`));

    const byTrack = await listUsers(admin, parseUserListParams({ track: ctx.tracks[0].id }));
    expect(byTrack.items.map((u) => u.id)).toEqual([ctx.users.supervisor.id]);
    expect(byTrack.items[0].trackNumbers).toEqual([1]);
  });
});

describe("users: create", () => {
  it("creates an account with a one-time password that is only stored hashed and must be changed", async () => {
    const result = await createUser(admin, userInput({ username: "khalid.m", email: "Khalid@Example.org", phone: "0500000002" }));
    if (!result.ok) throw new Error(result.message);
    const user = await db.user.findUniqueOrThrow({ where: { id: result.userId }, include: { accounts: true } });
    expect(user.mustChangePassword).toBe(true);
    expect(user.email).toBe("khalid@example.org");
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0].password).not.toBe(result.password);
    expect(await verifyPassword({ hash: user.accounts[0].password!, password: result.password })).toBe(true);

    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "user.created", entityId: user.id } });
    expect(entry.actorId).toBe(admin.id);
    expect(entry.after).toMatchObject({ username: "khalid.m", role: "UNIT_MANAGER", mustChangePassword: true });
    await expectNoSecretsInAudit(result.password);
  });

  it("assigns supervisors to one or more tracks and refuses unknown tracks", async () => {
    const ok = await createUser(admin, userInput({ role: "SUPERVISOR", trackIds: [ctx.tracks[1].id, ctx.tracks[3].id] }));
    if (!ok.ok) throw new Error("expected ok");
    expect((await db.supervisorTrack.findMany({ where: { userId: ok.userId } })).map((t) => t.trackId).sort()).toEqual(
      [ctx.tracks[1].id, ctx.tracks[3].id].sort(),
    );
    const bad = await createUser(admin, userInput({ role: "SUPERVISOR", trackIds: ["missing"] }));
    expect(bad).toMatchObject({ ok: false, errors: { trackIds: expect.any(String) } });
  });

  it("refuses duplicate usernames and emails", async () => {
    expect(await createUser(admin, userInput({ username: ctx.users.manager.username }))).toMatchObject({ ok: false, errors: { username: expect.any(String) } });
    await createUser(admin, userInput({ username: "first.mail", email: "same@example.org" }));
    expect(await createUser(admin, userInput({ username: "second.mail", email: "same@example.org" }))).toMatchObject({
      ok: false,
      errors: { email: expect.any(String) },
    });
  });

  it("links an officer to exactly one association, and an association has exactly one officer", async () => {
    const free = await makeAssociation("جمعية بلا حساب");
    const first = await createUser(admin, userInput({ role: "ASSOCIATION_OFFICER", associationId: free.id }));
    expect(first.ok).toBe(true);
    const second = await createUser(admin, userInput({ role: "ASSOCIATION_OFFICER", associationId: free.id }));
    expect(second).toMatchObject({ ok: false, errors: { associationId: expect.stringContaining("حساب مسؤول") } });
    expect(await db.user.count({ where: { associationId: free.id } })).toBe(1);

    // Moving another officer onto a taken association is refused too.
    const other = await makeAssociation("جمعية ثانية");
    const created = await createUser(admin, userInput({ role: "ASSOCIATION_OFFICER", associationId: other.id }));
    if (!created.ok) throw new Error("expected ok");
    const moved = await updateUser(admin, created.userId, userInput({ username: created.username, role: "ASSOCIATION_OFFICER", associationId: free.id }));
    expect(moved).toMatchObject({ ok: false, errors: { associationId: expect.any(String) } });

    const inactive = await makeAssociation("جمعية معطلة", { isActive: false });
    expect(await createUser(admin, userInput({ role: "ASSOCIATION_OFFICER", associationId: inactive.id }))).toMatchObject({ ok: false });
  });

  it("only offers associations without an officer in the form", async () => {
    const free = await makeAssociation("جمعية متاحة");
    const options = await userFormOptions(admin);
    expect(options.associations.map((a) => a.id)).toEqual([free.id]);
    expect(options.tracks).toHaveLength(5);
    expect((await userFormOptions(admin, ctx.association.id)).associations.map((a) => a.id).sort()).toEqual([free.id, ctx.association.id].sort());
  });
});

describe("users: update rules", () => {
  it("refuses changing your own role", async () => {
    const self = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    const result = await updateUser(admin, admin.id, userInput({ username: self.username, name: self.name, role: "UNIT_MANAGER" }));
    expect(result).toMatchObject({ ok: false, errors: { role: expect.any(String) } });
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe("SUPER_ADMIN");
  });

  it("cannot demote or deactivate the last active super admin, but can while another remains", async () => {
    const other = await makeUser("SUPER_ADMIN");
    // Two active super admins: one may deactivate the other.
    expect((await setUserActive(actorOf(other), admin.id, false)).ok).toBe(true);

    // `other` is now the last active one. The rule is checked against the database, whoever asks
    // (the service is called directly here; in the app an inactive actor is already signed out).
    const otherRow = await db.user.findUniqueOrThrow({ where: { id: other.id } });
    expect(await setUserActive(admin, other.id, false)).toMatchObject({ ok: false, message: expect.stringContaining("آخر حساب نشط") });
    expect(await updateUser(admin, other.id, userInput({ username: otherRow.username, role: "UNIT_MANAGER" }))).toMatchObject({
      ok: false,
      errors: { role: expect.stringContaining("آخر حساب نشط") },
    });
    expect(await db.user.count({ where: { role: "SUPER_ADMIN", isActive: true } })).toBe(1);

    // Once a second active super admin exists again, the change goes through.
    await makeUser("SUPER_ADMIN");
    expect((await updateUser(admin, other.id, userInput({ username: otherRow.username, role: "UNIT_MANAGER" }))).ok).toBe(true);
  });

  it("refuses converting an officer to staff and staff to an officer", async () => {
    const officer = ctx.users.officer;
    expect(await updateUser(admin, officer.id, userInput({ username: officer.username, role: "SUPERVISOR", trackIds: [ctx.tracks[0].id] }))).toMatchObject({
      ok: false,
      errors: { role: expect.any(String) },
    });
    const free = await makeAssociation("جمعية حرة");
    expect(
      await updateUser(admin, ctx.users.manager.id, userInput({ username: ctx.users.manager.username, role: "ASSOCIATION_OFFICER", associationId: free.id })),
    ).toMatchObject({ ok: false, errors: { role: expect.any(String) } });
  });

  it("changes staff roles, replaces supervisor tracks and audits before and after", async () => {
    const sup = ctx.users.supervisor;
    const result = await updateUser(admin, sup.id, userInput({ username: sup.username, name: "اسم جديد", role: "SUPERVISOR", trackIds: [ctx.tracks[2].id] }));
    expect(result.ok).toBe(true);
    expect((await db.supervisorTrack.findMany({ where: { userId: sup.id } })).map((t) => t.trackId)).toEqual([ctx.tracks[2].id]);

    expect((await updateUser(admin, sup.id, userInput({ username: sup.username, name: "اسم جديد", role: "UNIT_MANAGER" }))).ok).toBe(true);
    expect(await db.supervisorTrack.count({ where: { userId: sup.id } })).toBe(0);

    const entries = await db.auditLog.findMany({ where: { action: "user.updated", entityId: sup.id }, orderBy: { createdAt: "asc" } });
    expect(entries).toHaveLength(2);
    expect(entries[0].before).toMatchObject({ trackIds: [ctx.tracks[0].id] });
    expect(entries[0].after).toMatchObject({ name: "اسم جديد", trackIds: [ctx.tracks[2].id] });
    expect(entries[1].after).toMatchObject({ role: "UNIT_MANAGER", trackIds: [] });
    await expectNoSecretsInAudit();
  });
});

describe("users: deactivation and password reset", () => {
  it("refuses deactivating yourself", async () => {
    expect(await setUserActive(admin, admin.id, false)).toMatchObject({ ok: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).isActive).toBe(true);
  });

  it("revokes sessions on deactivation and blocks sign-in until reactivated", async () => {
    const target = ctx.users.manager;
    const cookie = cookieFrom(await signIn(target.username!, TEST_PASSWORD));
    expect(await getSession(cookie)).not.toBeNull();

    const result = await setUserActive(admin, target.id, false);
    expect(result).toMatchObject({ ok: true, revokedSessions: 1 });
    expect(await db.session.count({ where: { userId: target.id } })).toBe(0);
    expect(await getSession(cookie)).toBeNull();
    expect((await signIn(target.username!, TEST_PASSWORD)).status).not.toBe(200);

    expect((await setUserActive(admin, target.id, true)).ok).toBe(true);
    expect((await signIn(target.username!, TEST_PASSWORD)).status).toBe(200);
    expect((await db.auditLog.findMany({ where: { entityId: target.id }, orderBy: { createdAt: "asc" } })).map((e) => e.action)).toEqual([
      "user.deactivated",
      "user.reactivated",
    ]);
  });

  it("does not reactivate an officer whose association is inactive", async () => {
    await db.association.update({ where: { id: ctx.association.id }, data: { isActive: false } });
    await db.user.update({ where: { id: ctx.users.officer.id }, data: { isActive: false } });
    expect(await setUserActive(admin, ctx.users.officer.id, true)).toMatchObject({ ok: false });
  });

  it("issues a new temporary password, revokes sessions and requires a change; the old password stops working", async () => {
    const target = ctx.users.supervisor;
    const cookie = cookieFrom(await signIn(target.username!, TEST_PASSWORD));
    const result = await resetUserPassword(admin, target.id);
    if (!result.ok) throw new Error(result.message);

    expect(await getSession(cookie)).toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).mustChangePassword).toBe(true);
    expect((await signIn(target.username!, TEST_PASSWORD)).status).not.toBe(200);
    expect((await signIn(target.username!, result.password)).status).toBe(200);

    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "user.password_reset" } });
    expect(entry.after).toEqual({ mustChangePassword: true, revokedSessions: 1 });
    await expectNoSecretsInAudit(result.password, TEST_PASSWORD);
  });

  it("refuses resetting your own password from the admin screen", async () => {
    expect(await resetUserPassword(admin, admin.id)).toMatchObject({ ok: false });
  });
});
