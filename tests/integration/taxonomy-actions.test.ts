// Phase 2b stop 1 server actions and routes, for every role (pattern of admin-actions.test.ts).

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { auth } from "@/server/auth/auth";
import type { CurrentUser } from "@/server/auth/session";
import { ROLES, type Role } from "@/server/authz/roles";
import { makeRoleActors, TEST_PASSWORD } from "../support/admin";
import { db, resetDatabase } from "../support/db";
import { makeTaxonomy } from "../support/taxonomy";

const session = vi.hoisted(() => ({ current: null as CurrentUser | null }));
vi.mock("@/server/auth/session", () => ({
  requireUser: vi.fn(async () => {
    if (!session.current) throw new Error("NEXT_REDIRECT /login");
    return session.current;
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const t = await import("@/server/actions/admin/taxonomy");
const at = await import("@/server/actions/admin/attachment-types");
const rq = await import("@/server/actions/admin/requirements");
const { FORBIDDEN_MESSAGE } = await import("@/server/actions/admin/state");

let ctx: Awaited<ReturnType<typeof makeRoleActors>>;
let tax: Awaited<ReturnType<typeof makeTaxonomy>>;

function signInAs(role: Role) {
  const key = ({ SUPER_ADMIN: "admin", UNIT_MANAGER: "manager", SUPERVISOR: "supervisor", ASSOCIATION_OFFICER: "officer" } as const)[role];
  const user = ctx.users[key];
  session.current = { ...ctx.actors[role], name: user.name, username: user.username, email: user.email, mustChangePassword: false, associationName: null };
}

function form(values: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) for (const item of [v].flat()) fd.append(k, item);
  return fd;
}

async function snapshot() {
  return {
    programs: await db.program.findMany({ orderBy: { number: "asc" } }),
    goals: await db.programGoal.findMany({ orderBy: { id: "asc" } }),
    initiatives: await db.initiative.findMany({ orderBy: { id: "asc" } }),
    objectives: await db.strategicObjective.findMany({ orderBy: { number: "asc" } }),
    links: await db.initiativeObjectiveLink.count(),
    types: await db.attachmentType.findMany({ orderBy: { key: "asc" } }),
    requirements: await db.initiativeRequirement.findMany({ orderBy: { id: "asc" } }),
    audit: await db.auditLog.count(),
  };
}

beforeEach(async () => {
  await resetDatabase();
  tax = await makeTaxonomy();
  ctx = await makeRoleActors();
  session.current = null;
});

describe("Phase 2b stop 1 server actions", () => {
  it("refuse the manager, supervisor and officer and change nothing", async () => {
    const [p] = tax.programs;
    const [i, other] = tax.initiatives;
    const goal = await db.programGoal.findFirstOrThrow({ where: { programId: p.id } });
    const planType = tax.types.find((x) => x.key === "program_plan")!;
    const req = await db.initiativeRequirement.create({ data: { initiativeId: i.id, kind: "FIELD", key: "count", label: "العدد", fieldType: "NUMBER" } });
    const before = await snapshot();

    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      signInAs(role);
      const results = [
        await t.createProgramAction({}, form({ number: "9", name: "برنامج", sortOrder: "9" })),
        await t.updateProgramAction(p.id, {}, form({ number: "1", name: "اسم آخر", sortOrder: "1" })),
        await t.setProgramActiveAction(p.id, false),
        await t.setProgramArchivedAction(p.id, true),
        await t.createGoalAction(p.id, {}, form({ text: "هدف جديد" })),
        await t.updateGoalAction(goal.id, {}, form({ text: "هدف معدل" })),
        await t.setGoalArchivedAction(goal.id, true),
        await t.moveGoalAction(goal.id, "down"),
        await t.createInitiativeAction(p.id, {}, form({ number: "40", name: "مبادرة جديدة" })),
        await t.updateInitiativeAction(i.id, {}, form({ number: "1", name: "اسم آخر" })),
        await t.setInitiativeActiveAction(i.id, false),
        await t.setInitiativeArchivedAction(i.id, true),
        await t.setInitiativeObjectivesAction(i.id, {}, form({ objectives: ["1", "2"] })),
        await t.updateObjectiveAction(tax.objectives[0].id, {}, form({ title: "عنوان آخر" })),
        await at.createAttachmentTypeAction({}, form({ key: "x_y", name: "نوع", groups: ["pdf"] })),
        await at.updateAttachmentTypeAction(planType.id, {}, form({ name: "اسم", groups: ["pdf"] })),
        await at.setAttachmentTypeArchivedAction(planType.id, true),
        await rq.createFieldRequirementAction(i.id, {}, form({ key: "other", label: "حقل", fieldType: "TEXT" })),
        await rq.updateFieldRequirementAction(req.id, {}, form({ label: "حقل", fieldType: "TEXT" })),
        await rq.createAttachmentRequirementAction(i.id, {}, form({ attachmentTypeId: planType.id, isRequired: "on" })),
        await rq.updateAttachmentRequirementAction(req.id, {}, form({})),
        await rq.removeRequirementAction(req.id),
        await rq.moveRequirementAction(req.id, "down"),
        await rq.copyRequirementsAction(i.id, { initiativeIds: [other.id] }),
      ];
      for (const r of results) expect(r, role).toEqual({ ok: false, message: FORBIDDEN_MESSAGE });
      expect(await rq.previewCopyAction(i.id, { initiativeIds: [other.id] }), role).toEqual({ ok: false, message: FORBIDDEN_MESSAGE });
    }
    expect(await snapshot()).toEqual(before);
  });

  it("require a signed-in user", async () => {
    await expect(t.createProgramAction({}, form({ number: "9", name: "برنامج", sortOrder: "9" }))).rejects.toThrow(/login/);
    await expect(rq.previewCopyAction(tax.initiatives[0].id, { initiativeIds: [] })).rejects.toThrow(/login/);
  });

  it("work for the super admin, including validation errors and the copy flow", async () => {
    signInAs("SUPER_ADMIN");
    const [i, other] = tax.initiatives;
    expect(await rq.createFieldRequirementAction(i.id, {}, form({ key: "title", label: "عنوان", fieldType: "TEXT" }))).toMatchObject({
      ok: false,
      errors: { key: expect.stringContaining("محجوز") },
    });
    expect(await rq.createFieldRequirementAction(i.id, {}, form({ key: "level", label: "المستوى", fieldType: "SELECT", options: "\n" }))).toMatchObject({
      ok: false,
      errors: { options: expect.any(String) },
    });
    expect((await rq.createFieldRequirementAction(i.id, {}, form({ key: "level", label: "المستوى", fieldType: "SELECT", options: "أ\nب", isRequired: "on" }))).ok).toBe(true);
    const preview = await rq.previewCopyAction(i.id, { initiativeIds: [other.id] });
    expect(preview).toMatchObject({ ok: true, sourceCount: 1, items: [{ added: ["level"], removed: [], overwritten: [] }] });
    expect(await rq.copyRequirementsAction(i.id, { initiativeIds: [other.id] })).toEqual({ ok: true, message: "نُسخت المتطلبات إلى مبادرة واحدة." });
    expect(await db.initiativeRequirement.count({ where: { initiativeId: other.id } })).toBe(1);

    expect(await t.createProgramAction({}, form({ number: "٨", name: "برنامج ثامن", officialName: "", description: "", sortOrder: "٨" }))).toMatchObject({
      ok: true,
      createdId: "8",
    });
    expect(await at.createAttachmentTypeAction({}, form({ key: "venue_permit", name: "تصريح", groups: ["video"] }))).toMatchObject({ ok: false });
  });
});

describe("Phase 2b stop 1 routes (proxy)", () => {
  const BASE = "http://localhost:3000";
  let ip = 0;

  async function cookieFor(username: string) {
    ip += 1;
    const response = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/username`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": `10.40.0.${ip}` },
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
    ["/admin/taxonomy", "SUPER_ADMIN"],
    ["/admin/taxonomy/programs/new", "SUPER_ADMIN"],
    ["/admin/taxonomy/programs/1", "SUPER_ADMIN"],
    ["/admin/taxonomy/programs/1/new-initiative", "SUPER_ADMIN"],
    ["/admin/taxonomy/initiatives/some-id", "SUPER_ADMIN"],
    ["/admin/taxonomy/objectives", "SUPER_ADMIN"],
    ["/admin/taxonomy/attachment-types", "SUPER_ADMIN"],
    ["/admin/taxonomy/review", "SUPER_ADMIN"],
    ["/manager/taxonomy", "UNIT_MANAGER"],
    ["/manager/taxonomy/programs/1", "UNIT_MANAGER"],
    ["/manager/taxonomy/initiatives/some-id", "UNIT_MANAGER"],
    ["/manager/taxonomy/objectives", "UNIT_MANAGER"],
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
