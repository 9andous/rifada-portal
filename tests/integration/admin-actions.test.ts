// Server actions and routes of Phase 2a, for every role. The actions are called directly with the
// signed-in user mocked, so each action's own guard is proven (not only the services underneath);
// the routes go through the real proxy with real Better Auth sessions.

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { auth } from "@/server/auth/auth";
import type { CurrentUser } from "@/server/auth/session";
import type { Role } from "@/server/authz/roles";
import { ROLES } from "@/server/authz/roles";
import { makeRoleActors, TEST_PASSWORD } from "../support/admin";
import { db, resetDatabase } from "../support/db";

const session = vi.hoisted(() => ({ current: null as CurrentUser | null }));

vi.mock("@/server/auth/session", () => ({
  requireUser: vi.fn(async () => {
    if (!session.current) throw new Error("NEXT_REDIRECT /login");
    return session.current;
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createUserAction, resetUserPasswordAction, setUserActiveAction, updateUserAction } = await import("@/server/actions/admin/users");
const { createAssociationAction, createAssociationOfficerAction, setAssociationActiveAction, updateAssociationAction } = await import(
  "@/server/actions/admin/associations"
);
const { updateSettingsAction } = await import("@/server/actions/admin/settings");
const { FORBIDDEN_MESSAGE } = await import("@/server/actions/admin/state");

let ctx: Awaited<ReturnType<typeof makeRoleActors>>;

function signInAs(role: Role) {
  const user = ctx.users[{ SUPER_ADMIN: "admin", UNIT_MANAGER: "manager", SUPERVISOR: "supervisor", ASSOCIATION_OFFICER: "officer" }[role] as keyof typeof ctx.users];
  session.current = {
    ...ctx.actors[role],
    name: user.name,
    username: user.username,
    email: user.email,
    mustChangePassword: false,
    associationName: null,
    imageUrl: null,
  };
}

function form(values: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) for (const item of [v].flat()) fd.append(k, item);
  return fd;
}

const userForm = (username: string) => form({ username, name: "مستخدم جديد", email: "", phone: "", role: "UNIT_MANAGER" });
const associationForm = (name: string) =>
  form({ name, licenseNumber: "", city: "", region: "", classification: "", contactName: "سعد", contactEmail: "a@example.org", contactPhone: "0500000000" });
const officerForm = (username: string) => form({ "officer.username": username, "officer.name": "ماجد الحربي", "officer.email": "", "officer.phone": "" });
const settingsForm = () =>
  form({ "sla.workingDays": "9", "uploads.maxFileMb": "25", "uploads.allowedGroups": ["pdf", "word"], "uploads.associationQuotaMb": "2048", "bulk.maxItems": "25" });

beforeEach(async () => {
  await resetDatabase();
  ctx = await makeRoleActors();
  session.current = null;
});

describe("Phase 2a server actions", () => {
  it("refuse every role except the super admin and change nothing", async () => {
    const target = ctx.users.manager.id;
    const freeAssociation = await db.association.create({ data: { name: "جمعية بلا مسؤول", contactName: "سعد" } });
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      signInAs(role);
      const results = [
        await createUserAction({}, userForm(`x.${role.toLowerCase()}`)),
        await updateUserAction(target, {}, userForm("renamed")),
        await setUserActiveAction(target, false),
        await resetUserPasswordAction(target),
        await createAssociationAction({}, associationForm(`جمعية من ${role}`)),
        await updateAssociationAction(ctx.association.id, {}, associationForm("اسم آخر")),
        await setAssociationActiveAction(ctx.association.id, false),
        await createAssociationOfficerAction(freeAssociation.id, {}, officerForm(`o.${role.toLowerCase()}`)),
        await updateSettingsAction({}, settingsForm()),
      ];
      for (const result of results) {
        expect(result, role).toEqual({ ok: false, message: FORBIDDEN_MESSAGE });
        expect(result.credentials).toBeUndefined();
      }
    }
    expect(await db.user.count()).toBe(4);
    expect(await db.association.count()).toBe(2);
    expect(await db.setting.count()).toBe(0);
    expect(await db.auditLog.count()).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: ctx.users.manager.id } })).isActive).toBe(true);
  });

  it("require a signed-in user", async () => {
    await expect(createUserAction({}, userForm("anon.user"))).rejects.toThrow(/login/);
    await expect(updateSettingsAction({}, settingsForm())).rejects.toThrow(/login/);
  });

  it("work for the super admin and return the one-time password only in the response", async () => {
    signInAs("SUPER_ADMIN");
    const created = await createUserAction({}, userForm("fresh.manager"));
    expect(created.ok).toBe(true);
    expect(created.credentials?.username).toBe("fresh.manager");
    const password = created.credentials!.password;

    const withOfficer = await createAssociationAction(
      {},
      (() => {
        const fd = associationForm("جمعية خدمة ضيوف الرحمن");
        fd.set("createOfficer", "on");
        fd.set("officer.username", "officer.khidma");
        fd.set("officer.name", "ماجد الحربي");
        return fd;
      })(),
    );
    expect(withOfficer).toMatchObject({ ok: true, credentials: { username: "officer.khidma" } });

    const later = await db.association.create({ data: { name: "جمعية تُضاف لاحقًا", contactName: "سعد" } });
    const officerLater = await createAssociationOfficerAction(later.id, {}, officerForm("officer.later"));
    expect(officerLater).toMatchObject({ ok: true, credentials: { username: "officer.later" } });
    expect((await db.user.findUniqueOrThrow({ where: { username: "officer.later" } })).associationId).toBe(later.id);
    expect(await createAssociationOfficerAction(later.id, {}, officerForm("officer.again"))).toMatchObject({ ok: false });

    const reset = await resetUserPasswordAction(created.createdId!);
    expect(reset.credentials?.password).toMatch(/^[A-Za-z2-9]{14}$/);
    expect((await updateSettingsAction({}, settingsForm())).ok).toBe(true);

    const stored = JSON.stringify(await db.auditLog.findMany());
    for (const secret of [password, withOfficer.credentials!.password, officerLater.credentials!.password, reset.credentials!.password]) {
      expect(stored).not.toContain(secret);
    }
    expect(stored).not.toMatch(/\$argon2/);
  });

  it("return Arabic field errors for invalid input", async () => {
    signInAs("SUPER_ADMIN");
    const result = await createUserAction({}, form({ username: "x", name: "", role: "SUPERVISOR" }));
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors ?? {}).sort()).toEqual(["name", "programIds", "username"]);
    const officer = await createAssociationAction({}, (() => {
      const fd = associationForm("جمعية");
      fd.set("createOfficer", "on");
      return fd;
    })());
    expect(Object.keys(officer.errors ?? {}).sort()).toEqual(["officer.name", "officer.username"]);
    const settings = await updateSettingsAction({}, form({ "sla.workingDays": "0", "uploads.maxFileMb": "25", "uploads.associationQuotaMb": "2048", "bulk.maxItems": "25" }));
    expect(Object.keys(settings.errors ?? {}).sort()).toEqual(["sla.workingDays", "uploads.allowedGroups"]);
  });
});

describe("Phase 2a routes (proxy)", () => {
  const BASE = "http://localhost:3000";
  let ip = 0;

  async function cookieFor(username: string) {
    ip += 1;
    const response = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/username`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": `10.30.0.${ip}` },
        body: JSON.stringify({ username, password: TEST_PASSWORD }),
      }),
    );
    expect(response.status).toBe(200);
    return response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  }

  const ROUTES: [string, Role][] = [
    ["/admin/users", "SUPER_ADMIN"],
    ["/admin/users/new", "SUPER_ADMIN"],
    ["/admin/users/some-id", "SUPER_ADMIN"],
    ["/admin/associations", "SUPER_ADMIN"],
    ["/admin/associations/new", "SUPER_ADMIN"],
    ["/admin/associations/some-id", "SUPER_ADMIN"],
    ["/admin/settings", "SUPER_ADMIN"],
    ["/admin/audit", "SUPER_ADMIN"],
    ["/manager/associations", "UNIT_MANAGER"],
    ["/manager/associations/some-id", "UNIT_MANAGER"],
  ];

  it("let only the owning role through and answer 403 to every other role", async () => {
    const usernames = { SUPER_ADMIN: ctx.users.admin, UNIT_MANAGER: ctx.users.manager, SUPERVISOR: ctx.users.supervisor, ASSOCIATION_OFFICER: ctx.users.officer };
    for (const role of ROLES) {
      const cookie = await cookieFor(usernames[role].username!);
      for (const [path, owner] of ROUTES) {
        const response = await proxy(new NextRequest(`${BASE}${path}`, { headers: { cookie } }));
        if (role === owner) {
          expect(response.status, `${role} -> ${path}`).toBe(200);
          expect(response.headers.get("x-middleware-rewrite")).toBeNull();
        } else {
          expect(response.status, `${role} -> ${path}`).toBe(403);
          expect(response.headers.get("x-middleware-rewrite")).toContain("/forbidden");
        }
      }
    }
  });

  it("send anonymous visitors to the login page", async () => {
    for (const [path] of ROUTES) {
      const response = await proxy(new NextRequest(`${BASE}${path}`));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    }
  });
});
