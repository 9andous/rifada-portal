// Phase 2b stop 2 server actions and page routes, for every role (pattern of taxonomy-actions.test.ts).

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedStatuses } from "../../prisma/seed/statuses";
import { proxy } from "@/proxy";
import { auth } from "@/server/auth/auth";
import type { CurrentUser } from "@/server/auth/session";
import { ROLES, type Role } from "@/server/authz/roles";
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

const st = await import("@/server/actions/admin/statuses");
const tp = await import("@/server/actions/admin/templates");
const { FORBIDDEN_MESSAGE } = await import("@/server/actions/admin/state");

let ctx: Awaited<ReturnType<typeof makeRoleActors>>;

function signInAs(role: Role) {
  const key = ({ SUPER_ADMIN: "admin", UNIT_MANAGER: "manager", SUPERVISOR: "supervisor", ASSOCIATION_OFFICER: "officer" } as const)[role];
  const user = ctx.users[key];
  session.current = { ...ctx.actors[role], name: user.name, username: user.username, email: user.email, mustChangePassword: false, associationName: null, imageUrl: null };
}

function form(values: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) for (const item of [v].flat()) fd.append(k, item);
  return fd;
}

beforeEach(async () => {
  await resetDatabase();
  await seedStatuses(db);
  ctx = await makeRoleActors();
  session.current = null;
});

describe("Phase 2b stop 2 server actions", () => {
  it("refuse the manager, supervisor and officer and change nothing", async () => {
    const status = await db.requestStatus.findFirstOrThrow({ where: { key: "DRAFT" } });
    const transition = await db.statusTransition.findFirstOrThrow();
    const [returned, rejected] = await Promise.all([
      db.requestStatus.findFirstOrThrow({ where: { key: "RETURNED" } }),
      db.requestStatus.findFirstOrThrow({ where: { key: "REJECTED" } }),
    ]);
    const template = await db.template.create({ data: { title: "نموذج", storageKey: `templates/${"a".repeat(32)}`, fileName: "a.pdf", mime: "application/pdf", size: 10 } });
    const before = JSON.stringify([await db.requestStatus.findMany({ orderBy: { id: "asc" } }), await db.statusTransition.findMany({ orderBy: { id: "asc" } }), await db.template.findMany()]);

    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      signInAs(role);
      const results = [
        await st.updateStatusAction(status.id, {}, form({ name: "اسم آخر", tone: "info" })),
        await st.moveStatusAction(status.id, "down"),
        await st.createTransitionAction({}, form({ fromStatusId: returned.id, toStatusId: rejected.id, roles: ["UNIT_MANAGER"] })),
        await st.updateTransitionAction(transition.id, {}, form({ roles: ["UNIT_MANAGER"] })),
        await st.removeTransitionAction(transition.id),
        await tp.createTemplateAction({}, form({ title: "نموذج جديد", uploadId: "a".repeat(32) })),
        await tp.updateTemplateAction(template.id, {}, form({ title: "عنوان آخر" })),
        await tp.replaceTemplateFileAction(template.id, {}, form({ uploadId: "a".repeat(32) })),
        await tp.setTemplatePublishedAction(template.id, true),
        await tp.setTemplateArchivedAction(template.id, true),
      ];
      for (const r of results) expect(r, role).toEqual({ ok: false, message: FORBIDDEN_MESSAGE });
    }
    const after = JSON.stringify([await db.requestStatus.findMany({ orderBy: { id: "asc" } }), await db.statusTransition.findMany({ orderBy: { id: "asc" } }), await db.template.findMany()]);
    expect(after).toBe(before);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("validate input for the super admin", async () => {
    signInAs("SUPER_ADMIN");
    const status = await db.requestStatus.findFirstOrThrow({ where: { key: "DRAFT" } });
    expect(await st.updateStatusAction(status.id, {}, form({ name: "م", tone: "purple" }))).toMatchObject({ ok: false, errors: { name: expect.any(String), tone: expect.any(String) } });
    expect(await tp.createTemplateAction({}, form({ title: "نموذج", uploadId: "" }))).toMatchObject({ ok: false, errors: { file: expect.any(String) } });
    expect(await st.updateStatusAction(status.id, {}, form({ name: "مسودة الطلب", tone: "info" }))).toMatchObject({ ok: true });
  });
});

describe("Phase 2b stop 2 page routes (proxy)", () => {
  const BASE = "http://localhost:3000";
  let ip = 0;
  async function cookieFor(username: string) {
    ip += 1;
    const response = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/username`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": `10.70.0.${ip}` },
        body: JSON.stringify({ username, password: TEST_PASSWORD }),
      }),
    );
    return response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  }

  const ROUTES: [string, Role][] = [
    ["/admin/settings/statuses", "SUPER_ADMIN"],
    ["/admin/taxonomy/templates", "SUPER_ADMIN"],
    ["/admin/taxonomy/templates/new", "SUPER_ADMIN"],
    ["/admin/taxonomy/templates/some-id", "SUPER_ADMIN"],
    ["/manager/taxonomy/templates", "UNIT_MANAGER"],
    ["/manager/taxonomy/lifecycle", "UNIT_MANAGER"],
    ["/supervisor/templates", "SUPERVISOR"],
    ["/association/documents", "ASSOCIATION_OFFICER"],
  ];

  it("let only the owning role through and answer 403 to every other role", async () => {
    const users = { SUPER_ADMIN: ctx.users.admin, UNIT_MANAGER: ctx.users.manager, SUPERVISOR: ctx.users.supervisor, ASSOCIATION_OFFICER: ctx.users.officer };
    for (const role of ROLES) {
      const cookie = await cookieFor(users[role].username!);
      for (const [path, owner] of ROUTES) {
        const response = await proxy(new NextRequest(`${BASE}${path}`, { headers: { cookie } }));
        expect(response.status, `${role} -> ${path}`).toBe(role === owner ? 200 : 403);
      }
    }
  });
});
