import { beforeEach, describe, expect, it } from "vitest";
import type { Role } from "@/server/authz/roles";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import {
  createGoal,
  createInitiative,
  createProgram,
  getInitiativeDetail,
  getProgramDetail,
  getProgramMatrix,
  initiativePickerOptions,
  listInitiatives,
  listObjectives,
  listPrograms,
  moveGoal,
  parseInitiativeListParams,
  parseProgramListParams,
  setGoalArchived,
  setInitiativeActive,
  setInitiativeArchived,
  setInitiativeObjectives,
  setProgramActive,
  setProgramArchived,
  taxonomyFigures,
  updateGoal,
  updateInitiative,
  updateObjective,
  updateProgram,
  wordingReview,
} from "@/server/services/admin/taxonomy-editor";
import { availableInitiativeWhere, getTaxonomy } from "@/server/services/taxonomy";
import { makeRoleActors } from "../support/admin";
import { db, resetDatabase } from "../support/db";
import { makeTaxonomy } from "../support/taxonomy";

let actors: Awaited<ReturnType<typeof makeRoleActors>>["actors"];
let admin: Actor;
let tax: Awaited<ReturnType<typeof makeTaxonomy>>;

const program = (overrides: Record<string, unknown> = {}) => ({ number: 9, name: "برنامج تجريبي", officialName: null, description: null, sortOrder: 9, ...overrides });
const initiative = (overrides: Record<string, unknown> = {}) => ({ number: 50, name: "مبادرة تجريبية", description: null, sourceNote: null, ...overrides });

async function counts() {
  return {
    programs: await db.program.count(),
    goals: await db.programGoal.count(),
    initiatives: await db.initiative.count(),
    objectives: await db.strategicObjective.count(),
    types: await db.attachmentType.count(),
  };
}

beforeEach(async () => {
  await resetDatabase();
  tax = await makeTaxonomy();
  // makeRoleActors creates 7 programs if fewer exist; ours has 2, so it adds 5 more (numbers 3–7).
  ({ actors } = await makeRoleActors());
  admin = actors.SUPER_ADMIN;
});

describe("taxonomy editor: permissions", () => {
  it("denies every write and every editor loader to the manager, supervisor and officer", async () => {
    const [p] = tax.programs;
    const [i] = tax.initiatives;
    const goal = await db.programGoal.findFirstOrThrow({ where: { programId: p.id } });
    const objective = tax.objectives[0];
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      const a = actors[role];
      const calls: (() => Promise<unknown>)[] = [
        () => listPrograms(a, parseProgramListParams({})),
        () => getProgramDetail(a, 1),
        () => listInitiatives(a, p.id, parseInitiativeListParams({})),
        () => getProgramMatrix(a, p.id),
        () => getInitiativeDetail(a, i.id),
        () => listObjectives(a),
        () => taxonomyFigures(a),
        () => wordingReview(a),
        () => initiativePickerOptions(a),
        () => createProgram(a, program()),
        () => updateProgram(a, p.id, program()),
        () => setProgramActive(a, p.id, false),
        () => setProgramArchived(a, p.id, true),
        () => createGoal(a, p.id, { text: "هدف" }),
        () => updateGoal(a, goal.id, { text: "هدف" }),
        () => setGoalArchived(a, goal.id, true),
        () => moveGoal(a, goal.id, "down"),
        () => createInitiative(a, p.id, initiative()),
        () => updateInitiative(a, i.id, initiative()),
        () => setInitiativeActive(a, i.id, false),
        () => setInitiativeArchived(a, i.id, true),
        () => setInitiativeObjectives(a, i.id, [1]),
        () => updateObjective(a, objective.id, { title: "عنوان", description: null }),
      ];
      for (const call of calls) await expect(call(), role).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.auditLog.count()).toBe(0);
  });

  it("gives every role the read-only views (non-archived only)", async () => {
    await setInitiativeArchived(admin, tax.initiatives[0].id, true);
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      const a = actors[role];
      expect((await listPrograms(a, parseProgramListParams({}), false)).length).toBe(7);
      const page = await listInitiatives(a, tax.programs[0].id, parseInitiativeListParams({ status: "archived" }), false);
      expect(page.items.map((x) => x.number)).toEqual([2, 3]);
      expect(await getInitiativeDetail(a, tax.initiatives[0].id, false)).toBeNull();
      expect((await getProgramMatrix(a, tax.programs[0].id, { editor: false, includeArchived: true })).initiatives).toHaveLength(2);
    }
  });
});

describe("programs", () => {
  it("creates and edits with a unique number, keeping the original name in the source note once", async () => {
    expect((await createProgram(admin, program())).ok).toBe(true);
    expect(await createProgram(admin, program({ name: "آخر" }))).toMatchObject({ ok: false, errors: { number: expect.any(String) } });

    const p = tax.programs[0];
    expect(await updateProgram(admin, p.id, program({ number: 2, name: p.name }))).toMatchObject({ ok: false, errors: { number: expect.any(String) } });
    expect((await updateProgram(admin, p.id, program({ number: 1, name: "برنامج الأئمة" }))).ok).toBe(true);
    expect((await updateProgram(admin, p.id, program({ number: 1, name: "برنامج الأئمة والخطباء" }))).ok).toBe(true);
    const stored = await db.program.findUniqueOrThrow({ where: { id: p.id } });
    expect(stored.sourceNote).toBe("النص الأصلي قبل التعديل: «برنامج الأئمة والمؤذنين».");
    const entries = await db.auditLog.findMany({ where: { action: "program.updated" }, orderBy: { createdAt: "asc" } });
    expect(entries).toHaveLength(2);
    expect(entries[0].before).toMatchObject({ name: "برنامج الأئمة والمؤذنين" });
  });

  it("pausing or archiving a program hides it and its initiatives (derived), without touching their flags; restoring reverses it", async () => {
    const p = tax.programs[0];
    const before = await db.initiative.findMany({ where: { programId: p.id }, select: { id: true, isActive: true, archivedAt: true }, orderBy: { number: "asc" } });

    const paused = await setProgramActive(admin, p.id, false);
    expect(paused).toEqual({ ok: true, affectedInitiatives: 3 });
    expect((await getTaxonomy(admin)).programs.map((x) => x.number)).not.toContain(1);
    expect(await db.initiative.count({ where: { ...availableInitiativeWhere, programId: p.id } })).toBe(0);
    expect(await db.initiative.findMany({ where: { programId: p.id }, select: { id: true, isActive: true, archivedAt: true }, orderBy: { number: "asc" } })).toEqual(before);

    await setProgramActive(admin, p.id, true);
    expect(await db.initiative.count({ where: { ...availableInitiativeWhere, programId: p.id } })).toBe(3);

    expect(await setProgramArchived(admin, p.id, true)).toEqual({ ok: true, affectedInitiatives: 3 });
    expect((await getTaxonomy(admin)).programs.map((x) => x.number)).not.toContain(1);
    expect(await db.initiative.count({ where: { ...availableInitiativeWhere, programId: p.id } })).toBe(0);
    await setProgramArchived(admin, p.id, false);
    expect((await getTaxonomy(admin)).programs.map((x) => x.number)).toContain(1);
    expect(await db.initiative.count({ where: { ...availableInitiativeWhere, programId: p.id } })).toBe(3);

    const actions = (await db.auditLog.findMany({ where: { entityId: p.id }, orderBy: { createdAt: "asc" } })).map((e) => e.action);
    expect(actions).toEqual(["program.deactivated", "program.activated", "program.archived", "program.restored"]);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "program.deactivated" } })).after).toEqual({ isActive: false, affectedInitiatives: 3 });
  });

  it("the extraction review still sees paused programs", async () => {
    await setProgramActive(admin, tax.programs[0].id, false);
    expect((await getTaxonomy(admin, { includePaused: true })).programs.map((x) => x.number)).toContain(1);
  });

  it("filters by state in the editor list", async () => {
    await setProgramActive(admin, tax.programs[0].id, false);
    await setProgramArchived(admin, tax.programs[1].id, true);
    expect((await listPrograms(admin, parseProgramListParams({ status: "paused" }))).map((p) => p.number)).toEqual([1]);
    expect((await listPrograms(admin, parseProgramListParams({ status: "archived" }))).map((p) => p.number)).toEqual([2]);
    expect((await listPrograms(admin, parseProgramListParams({}), false)).map((p) => p.number)).not.toContain(2);
  });
});

describe("goals", () => {
  it("adds at the end, edits with the original kept, reorders and archives (never deletes)", async () => {
    const p = tax.programs[0];
    await createGoal(admin, p.id, { text: "هدف رابع" });
    const goals = await db.programGoal.findMany({ where: { programId: p.id }, orderBy: { number: "asc" } });
    expect(goals.map((g) => g.number)).toEqual([1, 2, 3, 4]);

    await updateGoal(admin, goals[0].id, { text: "نص معدل" });
    expect((await db.programGoal.findUniqueOrThrow({ where: { id: goals[0].id } })).sourceNote).toContain("الهدف 1 للبرنامج");

    await moveGoal(admin, goals[3].id, "up");
    const reordered = await db.programGoal.findMany({ where: { programId: p.id }, orderBy: { number: "asc" } });
    expect(reordered.map((g) => g.text)).toEqual(["نص معدل", "الهدف 2 للبرنامج", "هدف رابع", "الهدف 3 للبرنامج"]);
    expect((await moveGoal(admin, reordered[0].id, "up")).ok).toBe(true); // already first: no change

    await setGoalArchived(admin, goals[1].id, true);
    expect((await getTaxonomy(admin)).programs.find((x) => x.number === 1)?.goals).toHaveLength(3);
    expect(await db.programGoal.count({ where: { programId: p.id } })).toBe(4);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "goal.reordered" } })).after).toEqual({ number: 3 });
  });
});

describe("initiatives", () => {
  it("keeps the number unique per program, also when renumbering", async () => {
    const [p1, p2] = tax.programs;
    expect(await createInitiative(admin, p1.id, initiative({ number: 2 }))).toMatchObject({ ok: false, errors: { number: expect.any(String) } });
    expect((await createInitiative(admin, p2.id, initiative({ number: 50 }))).ok).toBe(true);
    expect((await createInitiative(admin, p1.id, initiative({ number: 50 }))).ok).toBe(true); // same number, other program
    const i = tax.initiatives[0];
    expect(await updateInitiative(admin, i.id, initiative({ number: 3, name: i.name }))).toMatchObject({ ok: false, errors: { number: expect.any(String) } });
    expect((await updateInitiative(admin, i.id, initiative({ number: 7, name: i.name }))).ok).toBe(true);
  });

  it("refuses new initiatives in an archived program", async () => {
    await setProgramArchived(admin, tax.programs[0].id, true);
    expect(await createInitiative(admin, tax.programs[0].id, initiative())).toMatchObject({ ok: false });
  });

  it("keeps the original name in the source note, appended to an existing note", async () => {
    const i = tax.initiatives[0];
    await db.initiative.update({ where: { id: i.id }, data: { sourceNote: "يمتد في المصدر على صفين." } });
    await updateInitiative(admin, i.id, initiative({ number: 1, name: "اسم مصحح", sourceNote: "يمتد في المصدر على صفين." }));
    expect((await db.initiative.findUniqueOrThrow({ where: { id: i.id } })).sourceNote).toBe("يمتد في المصدر على صفين.\nالنص الأصلي قبل التعديل: «مبادرة 1-1».");
  });

  it("pauses and archives with audit; archived initiatives leave the general view but stay in the database", async () => {
    const i = tax.initiatives[0];
    const before = await counts();
    await setInitiativeActive(admin, i.id, false);
    expect((await getTaxonomy(admin)).programs[0].initiatives.map((x) => x.number)).toContain(1); // paused stays visible
    await setInitiativeArchived(admin, i.id, true);
    expect((await getTaxonomy(admin)).programs[0].initiatives.map((x) => x.number)).not.toContain(1);
    expect(await counts()).toEqual(before);
    const editor = await listInitiatives(admin, tax.programs[0].id, parseInitiativeListParams({ status: "archived" }));
    expect(editor.items.map((x) => x.number)).toEqual([1]);
  });

  it("replaces objective links with before/after audit and refuses unknown objectives", async () => {
    const i = tax.initiatives[0];
    await setInitiativeObjectives(admin, i.id, [3, 1]);
    await setInitiativeObjectives(admin, i.id, [1, 5, 7]);
    expect(await setInitiativeObjectives(admin, i.id, [1, 9])).toMatchObject({ ok: false });
    await setInitiativeObjectives(admin, i.id, [1, 5, 7]); // no change: no audit
    const entries = await db.auditLog.findMany({ where: { action: "initiative.links_updated" }, orderBy: { createdAt: "asc" } });
    expect(entries.map((e) => [e.before, e.after])).toEqual([
      [{ objectives: [] }, { objectives: [1, 3] }],
      [{ objectives: [1, 3] }, { objectives: [1, 5, 7] }],
    ]);
    const matrix = await getProgramMatrix(admin, tax.programs[0].id);
    expect(matrix.initiatives[0].objectives).toEqual([1, 5, 7]);
  });
});

describe("objectives", () => {
  it("edits title and description only, keeping the original title", async () => {
    const o = tax.objectives[0];
    await updateObjective(admin, o.id, { title: "عنوان جديد", description: "وصف" });
    const stored = await db.strategicObjective.findUniqueOrThrow({ where: { id: o.id } });
    expect(stored).toMatchObject({ number: 1, title: "عنوان جديد", description: "وصف", archivedAt: null });
    expect(stored.sourceNote).toContain("الهدف الإستراتيجي 1");
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "objective.updated" } })).before).toMatchObject({ title: "الهدف الإستراتيجي 1" });
  });
});

describe("wording review", () => {
  it("marks a slip resolved only once the stored name changes", async () => {
    const p2 = tax.programs[1];
    // Fixture initiative 2-4 stands in for a listed slip by giving it the listed wording.
    await db.initiative.create({ data: { programId: p2.id, number: 16, name: "غرس القيمية للأطفال" } });
    const slip = () => wordingReview(admin).then((s) => s.find((x) => x.program === 2 && x.initiatives[0].number === 16)!.initiatives[0]);
    expect(await slip()).toMatchObject({ resolved: false, current: "غرس القيمية للأطفال" });
    const row = await db.initiative.findFirstOrThrow({ where: { programId: p2.id, number: 16 } });
    await updateInitiative(admin, row.id, initiative({ number: 16, name: "غرس القيم للأطفال" }));
    expect(await slip()).toMatchObject({ resolved: true, current: "غرس القيم للأطفال" });
  });
});
