import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/server/authz/scope";
import { getByProgram, getMonthly, getOverdue, getOverview, getWorkload } from "@/server/services/dashboard";
import { db, resetDatabase } from "../support/db";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-22T09:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

const STATUS_KEYS = ["DRAFT", "SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW", "RETURNED", "APPROVED", "REJECTED"];

async function fixtures() {
  const statuses = Object.fromEntries(
    await Promise.all(
      STATUS_KEYS.map(async (key, i) => {
        const s = await db.requestStatus.create({ data: { key, name: key, colorToken: "neutral", sortOrder: i, isSystem: true } });
        return [key, s.id] as const;
      }),
    ),
  );
  const [a1, a2] = await Promise.all([
    db.association.create({ data: { name: "جمعية أ" } }),
    db.association.create({ data: { name: "جمعية ب" } }),
  ]);
  const [p1, p2] = await Promise.all([
    db.program.create({ data: { number: 1, name: "برنامج الأول" } }),
    db.program.create({ data: { number: 2, name: "برنامج الثاني" } }),
  ]);
  const [i1, i2] = await Promise.all([
    db.initiative.create({ data: { programId: p1.id, number: 1, name: "مبادرة ١" } }),
    db.initiative.create({ data: { programId: p2.id, number: 1, name: "مبادرة ٢" } }),
  ]);
  const user = (username: string, role: "SUPERVISOR" | "ASSOCIATION_OFFICER" | "UNIT_MANAGER", associationId?: string) =>
    db.user.create({ data: { username, name: username, email: `${username}@x.invalid`, role, associationId } });
  const [supervisor, officer1, officer2, manager] = await Promise.all([
    user("sup", "SUPERVISOR"),
    user("off1", "ASSOCIATION_OFFICER", a1.id),
    user("off2", "ASSOCIATION_OFFICER", a2.id),
    user("mgr", "UNIT_MANAGER"),
  ]);
  await db.supervisorProgram.create({ data: { userId: supervisor.id, programId: p1.id } });

  const request = (data: {
    association: string;
    program: string;
    initiative: string;
    status: string;
    submittedAt?: Date;
    decidedAt?: Date;
    slaDueAt?: Date;
    supervisor?: string;
    createdBy: string;
    title: string;
  }) =>
    db.request.create({
      data: {
        associationId: data.association,
        programId: data.program,
        initiativeId: data.initiative,
        statusId: statuses[data.status],
        submittedAt: data.submittedAt,
        decidedAt: data.decidedAt,
        slaDueAt: data.slaDueAt,
        assignedSupervisorId: data.supervisor,
        createdById: data.createdBy,
        title: data.title,
        referenceNo: data.submittedAt ? `RF-1448-${data.title}` : null,
      },
    });

  await request({ title: "overdue", association: a1.id, program: p1.id, initiative: i1.id, status: "UNDER_REVIEW", submittedAt: daysAgo(10), slaDueAt: daysAgo(2), supervisor: supervisor.id, createdBy: officer1.id });
  await request({ title: "approved", association: a1.id, program: p1.id, initiative: i1.id, status: "APPROVED", submittedAt: daysAgo(6), decidedAt: daysAgo(2), supervisor: supervisor.id, createdBy: officer1.id });
  await request({ title: "rejected", association: a2.id, program: p2.id, initiative: i2.id, status: "REJECTED", submittedAt: daysAgo(8), decidedAt: daysAgo(2), createdBy: officer2.id });
  await request({ title: "waiting", association: a2.id, program: p2.id, initiative: i2.id, status: "UNDER_REVIEW", submittedAt: daysAgo(1), slaDueAt: new Date(NOW.getTime() + 5 * DAY), createdBy: officer2.id });
  await request({ title: "draft", association: a1.id, program: p1.id, initiative: i1.id, status: "DRAFT", createdBy: officer1.id });

  const actor = (id: string, role: Actor["role"], extra: Partial<Actor> = {}): Actor => ({ id, role, associationId: null, programIds: [], ...extra });
  return {
    manager: actor(manager.id, "UNIT_MANAGER"),
    supervisor: actor(supervisor.id, "SUPERVISOR", { programIds: [p1.id] }),
    officer1: actor(officer1.id, "ASSOCIATION_OFFICER", { associationId: a1.id }),
    officer2: actor(officer2.id, "ASSOCIATION_OFFICER", { associationId: a2.id }),
    supervisorId: supervisor.id,
  };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("dashboard figures", () => {
  it("are all zero (and averages null) on an empty database", async () => {
    const manager: Actor = { id: "m", role: "UNIT_MANAGER", associationId: null, programIds: [] };
    const overview = await getOverview(manager, NOW);
    expect(overview).toMatchObject({ total: 0, open: 0, overdue: 0, unassigned: 0, avgHandlingDays: null, approvalRate: null });
    expect((await getMonthly(manager, 6, NOW)).map((m) => m.count)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(await getByProgram(manager)).toEqual([]);
    expect(await getWorkload(NOW)).toEqual([]);
    expect(await getOverdue(manager, 6, NOW)).toEqual([]);
  });

  it("match the database for the unit manager, leaving drafts out", async () => {
    const f = await fixtures();
    const o = await getOverview(f.manager, NOW);
    expect(o).toMatchObject({
      total: 4,
      open: 2,
      underReview: 2,
      approved: 1,
      rejected: 1,
      overdue: 1,
      unassigned: 1,
      avgHandlingDays: 5,
      approvalRate: 50,
    });
    expect((await getMonthly(f.manager, 6, NOW)).reduce((n, m) => n + m.count, 0)).toBe(4);
    expect((await getByProgram(f.manager)).map((p) => p.count)).toEqual([2, 2]);
    expect(await getWorkload(NOW)).toEqual([expect.objectContaining({ id: f.supervisorId, open: 1, overdue: 1, programs: ["برنامج الأول"] })]);
    const overdue = await getOverdue(f.manager, 6, NOW);
    expect(overdue.map((r) => [r.title, r.association])).toEqual([["overdue", "جمعية أ"]]);
  });

  it("stay inside a supervisor's programs", async () => {
    const f = await fixtures();
    const o = await getOverview(f.supervisor, NOW);
    // Drafts are not shown on staff dashboards; whether staff may read drafts at all is an open
    // Phase 3 item (DECISIONS.md D-026), so `drafts` is not asserted here.
    expect(o).toMatchObject({ total: 2, underReview: 1, approved: 1, rejected: 0, overdue: 1, approvalRate: 100 });
    expect((await getByProgram(f.supervisor)).map((p) => p.count)).toEqual([2, 0]);
  });

  it("stay inside an officer's association and count its drafts separately", async () => {
    const f = await fixtures();
    expect(await getOverview(f.officer1, NOW)).toMatchObject({ total: 2, drafts: 1, overdue: 1 });
    const o2 = await getOverview(f.officer2, NOW);
    expect(o2).toMatchObject({ total: 2, drafts: 0, overdue: 0, unassigned: 1 });
    expect(await getOverdue(f.officer2, 6, NOW)).toEqual([]);
  });
});
