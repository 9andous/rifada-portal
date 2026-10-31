import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { lastHijriMonths, hijriMonth } from "@/lib/format";
import { ForbiddenError, scopeRequests, type Actor } from "@/server/authz/scope";
import { db } from "@/server/db";

// Dashboard figures, always computed from the database and always limited to what the actor may
// see (scopeRequests). Phase 4 extends these (working-day SLA, notifications); the definitions
// below are recorded in docs/DECISIONS.md D-026.

/** Statuses that count as open (not yet decided). */
export const OPEN_KEYS = ["SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW", "RETURNED"] as const;
/** Statuses that close a request with a decision. */
export const DECIDED_KEYS = ["APPROVED", "REJECTED"] as const;
/** Open statuses the unit is responsible for; only these can be overdue against the SLA. */
export const SLA_KEYS = ["SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type StatusRow = { key: string; name: string; colorToken: string; count: number };

export type Overview = {
  total: number;
  open: number;
  underReview: number;
  returned: number;
  approved: number;
  rejected: number;
  drafts: number;
  overdue: number;
  unassigned: number;
  /** Mean calendar days from submission to decision; null when nothing is decided. */
  avgHandlingDays: number | null;
  /** Approved share of decided requests, 0–100; null when nothing is decided. */
  approvalRate: number | null;
  byStatus: StatusRow[];
};

async function statusIds(keys: readonly string[]) {
  const rows = await db.requestStatus.findMany({ where: { key: { in: [...keys] } }, select: { id: true } });
  return rows.map((r) => r.id);
}

/**
 * Request figures for the actor's scope. Staff dashboards leave drafts out (they are the
 * association's unfinished work); the association dashboard counts its own drafts separately.
 */
export async function getOverview(actor: Actor, now: Date = new Date()): Promise<Overview> {
  const scope = scopeRequests(actor);
  const statuses = await db.requestStatus.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, key: true, name: true, colorToken: true },
  });
  const grouped = await db.request.groupBy({ by: ["statusId"], where: scope, _count: { _all: true } });
  const countOf = (id: string) => grouped.find((g) => g.statusId === id)?._count._all ?? 0;
  const byKey = (key: string) => {
    const status = statuses.find((s) => s.key === key);
    return status ? countOf(status.id) : 0;
  };

  const byStatus = statuses
    .filter((s) => s.key !== "DRAFT")
    .map((s) => ({ key: s.key, name: s.name, colorToken: s.colorToken, count: countOf(s.id) }));

  const [slaIds, openIds] = await Promise.all([statusIds(SLA_KEYS), statusIds(OPEN_KEYS)]);
  const [overdue, unassigned, decided] = await Promise.all([
    db.request.count({ where: { AND: [scope, { statusId: { in: slaIds }, slaDueAt: { lt: now } }] } }),
    db.request.count({ where: { AND: [scope, { statusId: { in: openIds }, assignedSupervisorId: null }] } }),
    db.request.findMany({
      where: { AND: [scope, { decidedAt: { not: null }, submittedAt: { not: null } }] },
      select: { submittedAt: true, decidedAt: true },
    }),
  ]);

  const approved = byKey("APPROVED");
  const rejected = byKey("REJECTED");
  const avgHandlingDays = decided.length
    ? decided.reduce((sum, r) => sum + (r.decidedAt!.getTime() - r.submittedAt!.getTime()) / DAY_MS, 0) / decided.length
    : null;

  return {
    total: byStatus.reduce((n, s) => n + s.count, 0),
    open: OPEN_KEYS.reduce((n, k) => n + byKey(k), 0),
    underReview: byKey("SUBMITTED") + byKey("COMPLETENESS_CHECK") + byKey("UNDER_REVIEW"),
    returned: byKey("RETURNED"),
    approved,
    rejected,
    drafts: byKey("DRAFT"),
    overdue,
    unassigned,
    avgHandlingDays: avgHandlingDays === null ? null : Math.round(avgHandlingDays * 10) / 10,
    approvalRate: approved + rejected ? Math.round((approved / (approved + rejected)) * 100) : null,
    byStatus,
  };
}

export type MonthBucket = { key: string; name: string; count: number; decided: number };

/** Months the monthly card can show (its range switch). */
export const MONTH_RANGES = [3, 6, 12] as const;

/**
 * Per Hijri month for the last `months` months, oldest first: requests submitted (`count`) and
 * requests decided, approved or rejected (`decided`).
 */
export async function getMonthly(actor: Actor, months = 6, now: Date = new Date()): Promise<MonthBucket[]> {
  const buckets = lastHijriMonths(months, now).map((m) => ({ ...m, count: 0, decided: 0 }));
  const since = new Date(now.getTime() - (months * 30 + 2) * DAY_MS);
  const scope = scopeRequests(actor);
  const [submitted, decided] = await Promise.all([
    db.request.findMany({ where: { AND: [scope, { submittedAt: { gte: since, lte: now } }] }, select: { submittedAt: true } }),
    db.request.findMany({ where: { AND: [scope, { decidedAt: { gte: since, lte: now } }] }, select: { decidedAt: true } }),
  ]);
  for (const row of submitted) {
    const bucket = buckets.find((b) => b.key === hijriMonth(row.submittedAt!).key);
    if (bucket) bucket.count += 1;
  }
  for (const row of decided) {
    const bucket = buckets.find((b) => b.key === hijriMonth(row.decidedAt!).key);
    if (bucket) bucket.decided += 1;
  }
  return buckets;
}

export type ProgramRow = { id: string; number: number; name: string; count: number; open: number; decided: number };

/**
 * Submitted requests per program, in program order, split into open and decided (approved or
 * rejected). Only requests the supervisor classified under a programme count (D-123). Empty when
 * the taxonomy is not loaded.
 */
export async function getByProgram(actor: Actor): Promise<ProgramRow[]> {
  const scope = scopeRequests(actor);
  const [programs, openIds, decidedIds] = await Promise.all([
    db.program.findMany({ where: { archivedAt: null }, orderBy: { number: "asc" }, select: { id: true, number: true, name: true } }),
    statusIds(OPEN_KEYS),
    statusIds(DECIDED_KEYS),
  ]);
  const [all, open, decided] = await Promise.all([
    db.request.groupBy({ by: ["programId"], where: { AND: [scope, { submittedAt: { not: null } }] }, _count: { _all: true } }),
    db.request.groupBy({ by: ["programId"], where: { AND: [scope, { submittedAt: { not: null }, statusId: { in: openIds } }] }, _count: { _all: true } }),
    db.request.groupBy({ by: ["programId"], where: { AND: [scope, { statusId: { in: decidedIds } }] }, _count: { _all: true } }),
  ]);
  const count = (rows: typeof all, id: string) => rows.find((g) => g.programId === id)?._count._all ?? 0;
  return programs.map((p) => ({ ...p, count: count(all, p.id), open: count(open, p.id), decided: count(decided, p.id) }));
}

export type TrackRow = { id: string; number: number; name: string; count: number; open: number };

/**
 * Submitted requests in the actor's scope per track (D-119), by the track the association chose
 * (D-123). Requests without a track (none since D-123) come back as `unclassified`. Staff only:
 * the counts are internal.
 */
export async function getByTrack(actor: Actor): Promise<{ rows: TrackRow[]; unclassified: number; total: number }> {
  if (actor.role === "ASSOCIATION_OFFICER") throw new ForbiddenError("tracks are internal");
  const scope = scopeRequests(actor);
  const [tracks, openIds] = await Promise.all([
    db.track.findMany({ where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { number: "asc" }], select: { id: true, number: true, name: true } }),
    statusIds(OPEN_KEYS),
  ]);
  const [all, open] = await Promise.all([
    db.request.groupBy({ by: ["trackId"], where: { AND: [scope, { submittedAt: { not: null } }] }, _count: { _all: true } }),
    db.request.groupBy({ by: ["trackId"], where: { AND: [scope, { submittedAt: { not: null }, statusId: { in: openIds } }] }, _count: { _all: true } }),
  ]);
  const count = (rows: typeof all, id: string) => rows.find((g) => g.trackId === id)?._count._all ?? 0;
  const listed = new Set(tracks.map((t) => t.id));
  return {
    rows: tracks.map((t) => ({ id: t.id, number: t.number, name: t.name, count: count(all, t.id), open: count(open, t.id) })),
    unclassified: all.filter((g) => !g.trackId || !listed.has(g.trackId)).reduce((n, g) => n + g._count._all, 0),
    total: all.reduce((n, g) => n + g._count._all, 0),
  };
}

export type WorkloadRow = { id: string; name: string; tracks: string[]; open: number; overdue: number };

/** Open and overdue requests per active supervisor (management dashboards only). */
export async function getWorkload(now: Date = new Date()): Promise<WorkloadRow[]> {
  const [openIds, slaIds] = await Promise.all([statusIds(OPEN_KEYS), statusIds(SLA_KEYS)]);
  const [supervisors, open, overdue] = await Promise.all([
    db.user.findMany({
      where: { role: "SUPERVISOR", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, supervisedTracks: { orderBy: { track: { number: "asc" } }, select: { track: { select: { name: true } } } } },
    }),
    db.request.groupBy({ by: ["assignedSupervisorId"], where: { statusId: { in: openIds } }, _count: { _all: true } }),
    db.request.groupBy({
      by: ["assignedSupervisorId"],
      where: { statusId: { in: slaIds }, slaDueAt: { lt: now } },
      _count: { _all: true },
    }),
  ]);
  const count = (rows: typeof open, id: string) => rows.find((r) => r.assignedSupervisorId === id)?._count._all ?? 0;
  return supervisors.map((s) => ({
    id: s.id,
    name: s.name,
    tracks: s.supervisedTracks.map((st) => st.track.name),
    open: count(open, s.id),
    overdue: count(overdue, s.id),
  }));
}

export type OverdueRow = {
  id: string;
  referenceNo: string | null;
  title: string;
  association: string;
  supervisor: string | null;
  slaDueAt: Date;
};

/** The most overdue requests in the actor's scope. */
export async function getOverdue(actor: Actor, take = 6, now: Date = new Date()): Promise<OverdueRow[]> {
  const slaIds = await statusIds(SLA_KEYS);
  const where: Prisma.RequestWhereInput = { AND: [scopeRequests(actor), { statusId: { in: slaIds }, slaDueAt: { lt: now } }] };
  const rows = await db.request.findMany({
    where,
    orderBy: { slaDueAt: "asc" },
    take,
    select: {
      id: true,
      referenceNo: true,
      title: true,
      slaDueAt: true,
      association: { select: { name: true } },
      assignedSupervisor: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    referenceNo: r.referenceNo,
    title: r.title,
    association: r.association.name,
    supervisor: r.assignedSupervisor?.name ?? null,
    slaDueAt: r.slaDueAt!,
  }));
}
