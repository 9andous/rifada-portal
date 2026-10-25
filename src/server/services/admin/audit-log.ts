import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { enumParam, firstParam, pageWindow, type Page, type SearchParams, type SortDir } from "@/lib/list-params";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { assertCan } from "./common";

// Read-only by design: this module (and the whole codebase) has no path that updates or deletes
// audit rows. A unit test (tests/unit/admin-rules.test.ts) scans the source for any such call.

export const AUDIT_PAGE_SIZE = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Asia/Riyadh is UTC+3 all year (no daylight saving time). */
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Start of a Riyadh calendar day (YYYY-MM-DD) as a UTC instant, or null when malformed. */
export function riyadhDayStart(value: string | undefined): Date | null {
  if (!value || !DATE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const date = new Date(ms - RIYADH_OFFSET_MS);
  return new Date(ms).getUTCDate() === d ? date : null;
}

export function parseAuditListParams(params: SearchParams) {
  const page = Number.parseInt(firstParam(params, "page") ?? "1", 10);
  const text = (key: string) => {
    const v = firstParam(params, key)?.trim();
    return v ? v.slice(0, 100) : undefined;
  };
  return {
    actor: text("actor"),
    action: text("action"),
    entity: text("entity"),
    from: riyadhDayStart(firstParam(params, "from")) ? firstParam(params, "from") : undefined,
    to: riyadhDayStart(firstParam(params, "to")) ? firstParam(params, "to") : undefined,
    dir: (enumParam(params, "dir", ["asc", "desc"] as const) ?? "desc") as SortDir,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

export type AuditListParams = ReturnType<typeof parseAuditListParams>;

export type AuditRow = {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  actorUsername: string | null;
  ip: string | null;
  before: Prisma.JsonValue;
  after: Prisma.JsonValue;
};

export async function listAuditLog(actor: Actor, params: AuditListParams): Promise<Page<AuditRow>> {
  assertCan(actor, "audit.read");
  const where: Prisma.AuditLogWhereInput = {};
  if (params.actor === "system") where.actorId = null;
  else if (params.actor) where.actorId = params.actor;
  if (params.action) where.action = params.action;
  if (params.entity) where.entityType = params.entity;
  const from = riyadhDayStart(params.from);
  const toStart = riyadhDayStart(params.to);
  if (from || toStart) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      // Inclusive end date: everything before the start of the next Riyadh day.
      ...(toStart ? { lt: new Date(toStart.getTime() + 24 * 60 * 60 * 1000) } : {}),
    };
  }

  const total = await db.auditLog.count({ where });
  const win = pageWindow(total, params.page, AUDIT_PAGE_SIZE);
  const rows = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: params.dir }, { id: params.dir }],
    skip: win.skip,
    take: win.take,
    select: {
      id: true,
      createdAt: true,
      action: true,
      entityType: true,
      entityId: true,
      ip: true,
      before: true,
      after: true,
      actor: { select: { name: true, username: true } },
    },
  });
  return {
    items: rows.map(({ actor: a, ...r }) => ({ ...r, actorName: a?.name ?? null, actorUsername: a?.username ?? null })),
    total,
    page: win.page,
    pageSize: AUDIT_PAGE_SIZE,
    pageCount: win.pageCount,
  };
}

/** Values for the filter selects: actors that appear in the log, actions and entity types in use. */
export async function auditFilterOptions(actor: Actor) {
  assertCan(actor, "audit.read");
  const [actors, actions, entities] = await Promise.all([
    db.user.findMany({ where: { auditLogs: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true, username: true } }),
    db.auditLog.findMany({ distinct: ["action"], orderBy: { action: "asc" }, select: { action: true } }),
    db.auditLog.findMany({ distinct: ["entityType"], orderBy: { entityType: "asc" }, select: { entityType: true } }),
  ]);
  return { actors, actions: actions.map((a) => a.action), entities: entities.map((e) => e.entityType) };
}

/** Band figures: all entries, entries in the last 24 hours, distinct actors. */
export async function auditFigures(actor: Actor, now: Date = new Date()) {
  assertCan(actor, "audit.read");
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [total, lastDay, actors] = await Promise.all([
    db.auditLog.count(),
    db.auditLog.count({ where: { createdAt: { gte: since } } }),
    db.auditLog.findMany({ where: { actorId: { not: null } }, distinct: ["actorId"], select: { actorId: true } }),
  ]);
  return { total, lastDay, actors: actors.length };
}
