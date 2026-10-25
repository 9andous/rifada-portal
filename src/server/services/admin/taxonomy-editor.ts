import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { enumParam, pageWindow, parseListParams, type Page, type SearchParams } from "@/lib/list-params";
import { keepOriginalWording } from "@/lib/original-wording";
import { WORDING_SLIPS } from "@/lib/wording-review";
import type { GoalFormInput, InitiativeFormInput, ObjectiveFormInput, ProgramFormInput } from "@/lib/validation/taxonomy";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { PAGE_SIZE, assertCan, containsAny, fieldRefusal, lockAdminWrites, refuse, type Result } from "./common";

// Editors for programs, goals, initiatives, strategic objectives and initiative-objective links
// (Phase 2b stop 1). Nothing here deletes a row: programs and initiatives are paused («موقوف») or
// archived («مؤرشف»), goals are archived, objectives are only edited (D-050, D-053).

type Tx = Prisma.TransactionClient;

/** Editor loaders (with archived records) need taxonomy.manage; read-only views need taxonomy.read. */
function assertView(actor: Actor, editor: boolean) {
  assertCan(actor, editor ? "taxonomy.manage" : "taxonomy.read");
}

export type EntityState = "active" | "paused" | "archived";
export function entityState(e: { isActive: boolean; archivedAt: Date | null }): EntityState {
  return e.archivedAt ? "archived" : e.isActive ? "active" : "paused";
}
export const ENTITY_STATES = ["active", "paused", "archived"] as const;

function stateWhere(state: EntityState | undefined) {
  if (state === "archived") return { archivedAt: { not: null } };
  if (state === "paused") return { archivedAt: null, isActive: false };
  if (state === "active") return { archivedAt: null, isActive: true };
  return {};
}

// ---------------------------------------------------------------------------
// Audit snapshots (explicit fields)
// ---------------------------------------------------------------------------

const programSnapshot = (p: { number: number; name: string; officialName: string | null; description: string | null; sourceNote: string | null; sortOrder: number }) => ({
  number: p.number,
  name: p.name,
  officialName: p.officialName,
  description: p.description,
  sourceNote: p.sourceNote,
  sortOrder: p.sortOrder,
});

const initiativeSnapshot = (i: { number: number; name: string; description: string | null; sourceNote: string | null }) => ({
  number: i.number,
  name: i.name,
  description: i.description,
  sourceNote: i.sourceNote,
});

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export const PROGRAM_SORTS = ["sortOrder", "number", "name"] as const;

export function parseProgramListParams(params: SearchParams) {
  return { ...parseListParams(params, PROGRAM_SORTS, { sort: "sortOrder", dir: "asc" }), status: enumParam(params, "status", ENTITY_STATES) };
}

export async function listPrograms(actor: Actor, params: ReturnType<typeof parseProgramListParams>, editor = true) {
  assertView(actor, editor);
  const where: Prisma.ProgramWhereInput = editor ? stateWhere(params.status) : { archivedAt: null };
  if (params.q) where.OR = containsAny(params.q, ["name", "officialName"] as const);
  const order = params.sort === "sortOrder" ? [{ sortOrder: params.dir }, { number: "asc" as const }] : [{ [params.sort]: params.dir }];
  const programs = await db.program.findMany({
    where,
    orderBy: order,
    select: {
      id: true,
      number: true,
      name: true,
      officialName: true,
      isActive: true,
      archivedAt: true,
      sortOrder: true,
      _count: { select: { initiatives: { where: { archivedAt: null } }, goals: { where: { archivedAt: null } } } },
    },
  });
  return programs.map(({ _count, ...p }) => ({ ...p, state: entityState(p), initiativeCount: _count.initiatives, goalCount: _count.goals }));
}

export async function getProgramDetail(actor: Actor, number: number, editor = true) {
  assertView(actor, editor);
  const program = await db.program.findFirst({
    where: { number, ...(editor ? {} : { archivedAt: null }) },
    include: {
      goals: { where: editor ? {} : { archivedAt: null }, orderBy: { number: "asc" } },
      _count: { select: { initiatives: true } },
    },
  });
  if (!program) return null;
  const [activeInitiatives, archivedInitiatives] = await Promise.all([
    db.initiative.count({ where: { programId: program.id, archivedAt: null } }),
    db.initiative.count({ where: { programId: program.id, archivedAt: { not: null } } }),
  ]);
  return { ...program, state: entityState(program), activeInitiatives, archivedInitiatives };
}

export type ProgramDetail = NonNullable<Awaited<ReturnType<typeof getProgramDetail>>>;

async function programNumberFree(tx: Tx, number: number, exceptId?: string) {
  const other = await tx.program.findFirst({ where: { number, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
  return !other;
}

const MSG = {
  programNumberTaken: "رقم البرنامج مستخدم لبرنامج آخر.",
  initiativeNumberTaken: "رقم المبادرة مستخدم لمبادرة أخرى في هذا البرنامج.",
  notFound: "السجل غير موجود.",
  archivedProgram: "البرنامج مؤرشف؛ استعده أولًا.",
  archivedInitiative: "المبادرة مؤرشفة؛ استعدها أولًا.",
  unknownObjective: "أحد الأهداف المختارة غير موجود.",
} as const;

export async function createProgram(actor: Actor, input: ProgramFormInput): Promise<Result<{ number: number }>> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    if (!(await programNumberFree(tx, input.number))) return fieldRefusal("number", MSG.programNumberTaken);
    const program = await tx.program.create({ data: { ...input } });
    await audit({ actorId: actor.id, action: "program.created", entityType: "Program", entityId: program.id, after: programSnapshot(program) }, tx);
    return { ok: true, number: program.number };
  });
}

export async function updateProgram(actor: Actor, id: string, input: ProgramFormInput): Promise<Result<{ number: number }>> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const current = await tx.program.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    if (!(await programNumberFree(tx, input.number, id))) return fieldRefusal("number", MSG.programNumberTaken);
    const sourceNote = keepOriginalWording(current.sourceNote, current.name, input.name);
    const updated = await tx.program.update({ where: { id }, data: { ...input, sourceNote } });
    const before = programSnapshot(current);
    const after = programSnapshot(updated);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await audit({ actorId: actor.id, action: "program.updated", entityType: "Program", entityId: id, before, after }, tx);
    }
    return { ok: true, number: updated.number };
  });
}

/** Pause («موقوف») or reactivate. Its initiatives are hidden from new requests as a derived effect. */
export async function setProgramActive(actor: Actor, id: string, active: boolean): Promise<Result<{ affectedInitiatives: number }>> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.program.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    const affectedInitiatives = await tx.initiative.count({ where: { programId: id, archivedAt: null } });
    if (current.isActive === active) return { ok: true, affectedInitiatives };
    await tx.program.update({ where: { id }, data: { isActive: active } });
    await audit(
      {
        actorId: actor.id,
        action: active ? "program.activated" : "program.deactivated",
        entityType: "Program",
        entityId: id,
        before: { isActive: current.isActive },
        after: { isActive: active, affectedInitiatives },
      },
      tx,
    );
    return { ok: true, affectedInitiatives };
  });
}

export async function setProgramArchived(actor: Actor, id: string, archived: boolean): Promise<Result<{ affectedInitiatives: number }>> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.program.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    const affectedInitiatives = await tx.initiative.count({ where: { programId: id, archivedAt: null } });
    if (Boolean(current.archivedAt) === archived) return { ok: true, affectedInitiatives };
    await tx.program.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await audit(
      {
        actorId: actor.id,
        action: archived ? "program.archived" : "program.restored",
        entityType: "Program",
        entityId: id,
        before: { archived: !archived },
        after: { archived, affectedInitiatives },
      },
      tx,
    );
    return { ok: true, affectedInitiatives };
  });
}

// ---------------------------------------------------------------------------
// Goals (numbered within the program; the number is the order)
// ---------------------------------------------------------------------------

export async function createGoal(actor: Actor, programId: string, input: GoalFormInput): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const program = await tx.program.findUnique({ where: { id: programId }, select: { id: true } });
    if (!program) return refuse(MSG.notFound);
    const last = await tx.programGoal.aggregate({ where: { programId }, _max: { number: true } });
    const goal = await tx.programGoal.create({ data: { programId, number: (last._max.number ?? 0) + 1, text: input.text } });
    await audit({ actorId: actor.id, action: "goal.created", entityType: "ProgramGoal", entityId: goal.id, after: { programId, number: goal.number, text: goal.text } }, tx);
    return { ok: true };
  });
}

export async function updateGoal(actor: Actor, id: string, input: GoalFormInput): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.programGoal.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    if (current.text === input.text) return { ok: true };
    const sourceNote = keepOriginalWording(current.sourceNote, current.text, input.text);
    await tx.programGoal.update({ where: { id }, data: { text: input.text, sourceNote } });
    await audit(
      {
        actorId: actor.id,
        action: "goal.updated",
        entityType: "ProgramGoal",
        entityId: id,
        before: { number: current.number, text: current.text, sourceNote: current.sourceNote },
        after: { number: current.number, text: input.text, sourceNote },
      },
      tx,
    );
    return { ok: true };
  });
}

export async function setGoalArchived(actor: Actor, id: string, archived: boolean): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.programGoal.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    if (Boolean(current.archivedAt) === archived) return { ok: true };
    await tx.programGoal.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await audit(
      { actorId: actor.id, action: archived ? "goal.archived" : "goal.restored", entityType: "ProgramGoal", entityId: id, before: { archived: !archived }, after: { archived } },
      tx,
    );
    return { ok: true };
  });
}

/** Swaps the goal's number with its neighbour (the unique (program, number) pair needs a parking number). */
export async function moveGoal(actor: Actor, id: string, direction: "up" | "down"): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const goal = await tx.programGoal.findUnique({ where: { id } });
    if (!goal) return refuse(MSG.notFound);
    const neighbour = await tx.programGoal.findFirst({
      where: { programId: goal.programId, number: direction === "up" ? { lt: goal.number } : { gt: goal.number } },
      orderBy: { number: direction === "up" ? "desc" : "asc" },
    });
    if (!neighbour) return { ok: true };
    await tx.programGoal.update({ where: { id: goal.id }, data: { number: -1 } });
    await tx.programGoal.update({ where: { id: neighbour.id }, data: { number: goal.number } });
    await tx.programGoal.update({ where: { id: goal.id }, data: { number: neighbour.number } });
    await audit(
      { actorId: actor.id, action: "goal.reordered", entityType: "ProgramGoal", entityId: id, before: { number: goal.number }, after: { number: neighbour.number } },
      tx,
    );
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Initiatives
// ---------------------------------------------------------------------------

export const INITIATIVE_SORTS = ["number", "name"] as const;

export function parseInitiativeListParams(params: SearchParams) {
  return { ...parseListParams(params, INITIATIVE_SORTS, { sort: "number", dir: "asc" }), status: enumParam(params, "status", ENTITY_STATES) };
}

export async function listInitiatives(actor: Actor, programId: string, params: ReturnType<typeof parseInitiativeListParams>, editor = true) {
  assertView(actor, editor);
  const where: Prisma.InitiativeWhereInput = { programId, ...(editor ? stateWhere(params.status) : { archivedAt: null }) };
  if (params.q) {
    const asNumber = Number.parseInt(params.q, 10);
    where.OR = [...containsAny(params.q, ["name"] as const), ...(Number.isFinite(asNumber) ? [{ number: asNumber }] : [])];
  }
  const total = await db.initiative.count({ where });
  const win = pageWindow(total, params.page, PAGE_SIZE);
  const rows = await db.initiative.findMany({
    where,
    orderBy: [{ [params.sort]: params.dir }, { id: "asc" }],
    skip: win.skip,
    take: win.take,
    select: {
      id: true,
      number: true,
      name: true,
      isActive: true,
      archivedAt: true,
      _count: { select: { requirements: true, objectiveLinks: true } },
    },
  });
  const items = rows.map(({ _count, ...i }) => ({ ...i, state: entityState(i), requirementCount: _count.requirements, linkCount: _count.objectiveLinks }));
  return { items, total, page: win.page, pageSize: PAGE_SIZE, pageCount: win.pageCount } satisfies Page<(typeof items)[number]>;
}

/** Initiatives × objectives for one program (the matrix view). */
export async function getProgramMatrix(actor: Actor, programId: string, options: { editor?: boolean; includeArchived?: boolean } = {}) {
  const editor = options.editor ?? true;
  assertView(actor, editor);
  const [objectives, initiatives] = await Promise.all([
    db.strategicObjective.findMany({ where: { archivedAt: null }, orderBy: { number: "asc" }, select: { number: true, title: true } }),
    db.initiative.findMany({
      where: { programId, ...(editor && options.includeArchived ? {} : { archivedAt: null }) },
      orderBy: { number: "asc" },
      select: { id: true, number: true, name: true, isActive: true, archivedAt: true, objectiveLinks: { select: { objective: { select: { number: true } } } } },
    }),
  ]);
  return {
    objectives,
    initiatives: initiatives.map(({ objectiveLinks, ...i }) => ({
      ...i,
      state: entityState(i),
      objectives: objectiveLinks.map((l) => l.objective.number).sort((a, b) => a - b),
    })),
  };
}

export async function getInitiativeDetail(actor: Actor, id: string, editor = true) {
  assertView(actor, editor);
  const initiative = await db.initiative.findFirst({
    where: { id, ...(editor ? {} : { archivedAt: null, program: { archivedAt: null } }) },
    include: {
      program: { select: { id: true, number: true, name: true, isActive: true, archivedAt: true } },
      objectiveLinks: { select: { objective: { select: { number: true } } } },
    },
  });
  if (!initiative) return null;
  const objectives = await db.strategicObjective.findMany({ orderBy: { number: "asc" }, select: { id: true, number: true, title: true } });
  return {
    ...initiative,
    state: entityState(initiative),
    programState: entityState(initiative.program),
    linkedObjectives: initiative.objectiveLinks.map((l) => l.objective.number).sort((a, b) => a - b),
    objectives,
  };
}

export type InitiativeDetail = NonNullable<Awaited<ReturnType<typeof getInitiativeDetail>>>;

async function initiativeNumberFree(tx: Tx, programId: string, number: number, exceptId?: string) {
  const other = await tx.initiative.findFirst({ where: { programId, number, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
  return !other;
}

export async function createInitiative(actor: Actor, programId: string, input: InitiativeFormInput): Promise<Result<{ id: string }>> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const program = await tx.program.findUnique({ where: { id: programId }, select: { archivedAt: true } });
    if (!program) return refuse(MSG.notFound);
    if (program.archivedAt) return refuse(MSG.archivedProgram);
    if (!(await initiativeNumberFree(tx, programId, input.number))) return fieldRefusal("number", MSG.initiativeNumberTaken);
    const initiative = await tx.initiative.create({ data: { programId, ...input } });
    await audit(
      { actorId: actor.id, action: "initiative.created", entityType: "Initiative", entityId: initiative.id, after: { programId, ...initiativeSnapshot(initiative) } },
      tx,
    );
    return { ok: true, id: initiative.id };
  });
}

export async function updateInitiative(actor: Actor, id: string, input: InitiativeFormInput): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const current = await tx.initiative.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    if (!(await initiativeNumberFree(tx, current.programId, input.number, id))) return fieldRefusal("number", MSG.initiativeNumberTaken);
    const sourceNote = keepOriginalWording(input.sourceNote, current.name, input.name);
    const updated = await tx.initiative.update({ where: { id }, data: { ...input, sourceNote } });
    const before = initiativeSnapshot(current);
    const after = initiativeSnapshot(updated);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await audit({ actorId: actor.id, action: "initiative.updated", entityType: "Initiative", entityId: id, before, after }, tx);
    }
    return { ok: true };
  });
}

export async function setInitiativeActive(actor: Actor, id: string, active: boolean): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.initiative.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    if (current.isActive === active) return { ok: true };
    await tx.initiative.update({ where: { id }, data: { isActive: active } });
    await audit(
      { actorId: actor.id, action: active ? "initiative.activated" : "initiative.deactivated", entityType: "Initiative", entityId: id, before: { isActive: !active }, after: { isActive: active } },
      tx,
    );
    return { ok: true };
  });
}

export async function setInitiativeArchived(actor: Actor, id: string, archived: boolean): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.initiative.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    if (Boolean(current.archivedAt) === archived) return { ok: true };
    await tx.initiative.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await audit(
      { actorId: actor.id, action: archived ? "initiative.archived" : "initiative.restored", entityType: "Initiative", entityId: id, before: { archived: !archived }, after: { archived } },
      tx,
    );
    return { ok: true };
  });
}

/** Replaces the initiative's objective links (the 7-checkbox editor), audited with before and after. */
export async function setInitiativeObjectives(actor: Actor, id: string, objectiveNumbers: number[]): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  const wanted = [...new Set(objectiveNumbers)].sort((a, b) => a - b);
  return db.$transaction(async (tx) => {
    const initiative = await tx.initiative.findUnique({ where: { id }, include: { objectiveLinks: { select: { objective: { select: { number: true } } } } } });
    if (!initiative) return refuse(MSG.notFound);
    const objectives = await tx.strategicObjective.findMany({ where: { number: { in: wanted } }, select: { id: true, number: true } });
    if (objectives.length !== wanted.length) return refuse(MSG.unknownObjective);
    const before = initiative.objectiveLinks.map((l) => l.objective.number).sort((a, b) => a - b);
    if (JSON.stringify(before) === JSON.stringify(wanted)) return { ok: true };
    await tx.initiativeObjectiveLink.deleteMany({ where: { initiativeId: id } });
    if (objectives.length > 0) {
      await tx.initiativeObjectiveLink.createMany({ data: objectives.map((o) => ({ initiativeId: id, objectiveId: o.id })) });
    }
    await audit(
      { actorId: actor.id, action: "initiative.links_updated", entityType: "Initiative", entityId: id, before: { objectives: before }, after: { objectives: wanted } },
      tx,
    );
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Strategic objectives: title and description only (no create, no archive; D-053)
// ---------------------------------------------------------------------------

export async function listObjectives(actor: Actor, editor = true) {
  assertView(actor, editor);
  const rows = await db.strategicObjective.findMany({
    orderBy: { number: "asc" },
    select: { id: true, number: true, title: true, description: true, sourceNote: true, updatedAt: true, _count: { select: { initiativeLinks: true } } },
  });
  return rows.map(({ _count, ...o }) => ({ ...o, linkCount: _count.initiativeLinks }));
}

export async function updateObjective(actor: Actor, id: string, input: ObjectiveFormInput): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.strategicObjective.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    const sourceNote = keepOriginalWording(current.sourceNote, current.title, input.title);
    const updated = await tx.strategicObjective.update({ where: { id }, data: { ...input, sourceNote } });
    const snap = (o: typeof current) => ({ number: o.number, title: o.title, description: o.description, sourceNote: o.sourceNote });
    if (JSON.stringify(snap(current)) !== JSON.stringify(snap(updated))) {
      await audit({ actorId: actor.id, action: "objective.updated", entityType: "StrategicObjective", entityId: id, before: snap(current), after: snap(updated) }, tx);
    }
    return { ok: true };
  });
}

/** Programs and their non-archived initiatives, for the copy-requirements picker. */
export async function initiativePickerOptions(actor: Actor) {
  assertCan(actor, "taxonomy.manage");
  return db.program.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      name: true,
      initiatives: { where: { archivedAt: null }, orderBy: { number: "asc" }, select: { id: true, number: true, name: true } },
    },
  });
}

/**
 * The wording slips of docs/COPY-REVIEW.md with each initiative's current name. An entry is resolved
 * once the stored name differs from the listed source text; nothing is changed automatically.
 */
export async function wordingReview(actor: Actor) {
  assertCan(actor, "taxonomy.manage");
  const pairs = WORDING_SLIPS.flatMap((s) => s.initiatives.map((i) => ({ program: s.program, number: i.number })));
  const rows = await db.initiative.findMany({
    where: { OR: pairs.map((p) => ({ number: p.number, program: { number: p.program } })) },
    select: { id: true, number: true, name: true, program: { select: { number: true } } },
  });
  const byKey = new Map(rows.map((r) => [`${r.program.number}-${r.number}`, r]));
  return WORDING_SLIPS.map((slip) => ({
    ...slip,
    initiatives: slip.initiatives.map((i) => {
      const row = byKey.get(`${slip.program}-${i.number}`);
      return { ...i, id: row?.id ?? null, current: row?.name ?? null, resolved: row ? row.name !== i.text : false };
    }),
  }));
}

/** Band figures for the taxonomy hub (non-archived records). */
export async function taxonomyFigures(actor: Actor, editor = true) {
  assertView(actor, editor);
  const [programs, paused, initiatives, links, attachmentTypes, requirements] = await Promise.all([
    db.program.count({ where: { archivedAt: null } }),
    db.program.count({ where: { archivedAt: null, isActive: false } }),
    db.initiative.count({ where: { archivedAt: null } }),
    db.initiativeObjectiveLink.count({ where: { initiative: { archivedAt: null } } }),
    db.attachmentType.count({ where: { archivedAt: null } }),
    db.initiativeRequirement.count({ where: { initiative: { archivedAt: null } } }),
  ]);
  return { programs, paused, initiatives, links, attachmentTypes, requirements };
}
