import "server-only";
import { OPEN_STATUS_KEYS } from "@/lib/requests";
import { requestsPhrase } from "@/lib/format";
import { reasonSchema } from "@/lib/validation/requests";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { assertCan, refuse, type Result } from "@/server/services/admin/common";
import { audit } from "@/server/services/audit";
import { notify } from "@/server/services/notifications";
import { getSetting } from "@/server/settings/read";
import { activeManagerIds, requestRef, statusIds, type Client, type Tx } from "./common";

// Assignment (brief §7, D-082). On submission the request goes to an active supervisor of its
// track (D-123) with the fewest open requests (submitted, completeness check, under review, returned);
// ties go to the one assigned least recently, then by username. With no supervisor available the
// request stays unassigned and the unit managers are notified. The unit manager reassigns open
// requests at any time with a reason, recorded in AssignmentHistory.

const LOCK_NAMESPACE = 72_026;

export const bulkLimitMessage = (max: number) => `الحد الأقصى للإجراء الجماعي ${requestsPhrase(max)}؛ قلّل التحديد.`;

export type SupervisorLoad = { id: string; name: string; username: string | null; open: number; lastAssignedAt: Date | null };

/** Active supervisors of a track with their open workload and last assignment, in rule order. */
export async function rankedSupervisors(client: Client, trackId: string | null): Promise<SupervisorLoad[]> {
  if (!trackId) return [];
  const supervisors = await client.user.findMany({
    where: { role: "SUPERVISOR", isActive: true, supervisedTracks: { some: { trackId } } },
    select: { id: true, name: true, username: true },
  });
  if (supervisors.length === 0) return [];
  const ids = supervisors.map((s) => s.id);
  const openIds = await statusIds(OPEN_STATUS_KEYS, client);
  // Sequential: `client` may be an interactive transaction, which runs one query at a time.
  const open = await client.request.groupBy({ by: ["assignedSupervisorId"], where: { assignedSupervisorId: { in: ids }, statusId: { in: openIds } }, _count: { _all: true } });
  const last = await client.assignmentHistory.groupBy({ by: ["toUserId"], where: { toUserId: { in: ids } }, _max: { createdAt: true } });
  const openBy = new Map(open.map((o) => [o.assignedSupervisorId, o._count._all]));
  const lastBy = new Map(last.map((l) => [l.toUserId, l._max.createdAt]));
  return supervisors
    .map((s) => ({ ...s, open: openBy.get(s.id) ?? 0, lastAssignedAt: lastBy.get(s.id) ?? null }))
    .sort(
      (a, b) =>
        a.open - b.open ||
        (a.lastAssignedAt?.getTime() ?? 0) - (b.lastAssignedAt?.getTime() ?? 0) ||
        (a.username ?? "").localeCompare(b.username ?? ""),
    );
}

/** Serialises assignments per track so two simultaneous submissions see each other's load. */
async function lockTrack(tx: Tx, trackId: string | null) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE}::int, hashtext(${trackId ?? ""}))`;
}

async function isActiveSupervisorOf(client: Client, userId: string, trackId: string | null): Promise<boolean> {
  if (!trackId) return false;
  return Boolean(
    await client.user.findFirst({
      where: { id: userId, role: "SUPERVISOR", isActive: true, supervisedTracks: { some: { trackId } } },
      select: { id: true },
    }),
  );
}

/**
 * Assigns a request that has just been (re)submitted. On resubmission the current supervisor keeps
 * it while still active on the track. Returns the supervisor id, or null when nobody is available.
 */
export async function assignOnSubmission(
  tx: Tx,
  request: { id: string; trackId: string | null; assignedSupervisorId: string | null; referenceNo: string | null; title: string },
  actorId: string,
): Promise<string | null> {
  await lockTrack(tx, request.trackId);
  if (request.assignedSupervisorId && (await isActiveSupervisorOf(tx, request.assignedSupervisorId, request.trackId))) {
    return request.assignedSupervisorId;
  }
  const [chosen] = await rankedSupervisors(tx, request.trackId);
  const toUserId = chosen?.id ?? null;
  const changed = toUserId !== request.assignedSupervisorId;
  if (changed) {
    await tx.request.update({ where: { id: request.id }, data: { assignedSupervisorId: toUserId } });
    await tx.assignmentHistory.create({
      data: { requestId: request.id, fromUserId: request.assignedSupervisorId, toUserId, actorId: null, reason: null },
    });
  }
  if (changed || !toUserId) {
    await audit(
      {
        actorId: null,
        action: toUserId ? "request.auto_assigned" : "request.left_unassigned",
        entityType: "Request",
        entityId: request.id,
        before: { assignedSupervisorId: request.assignedSupervisorId },
        after: { ...requestRef(request), assignedSupervisorId: toUserId },
      },
      tx,
    );
  }
  const body = `${request.referenceNo ?? ""} — ${request.title}`;
  if (toUserId) {
    await notify(tx, [toUserId], { type: "request.assigned", title: "أُسند إليك طلب للمراجعة", body, requestId: request.id }, actorId);
  } else {
    await notify(tx, await activeManagerIds(tx), { type: "request.unassigned", title: "طلب بلا مشرف متاح", body, requestId: request.id }, actorId);
  }
  return toUserId;
}

export type BulkSkip = { id: string; referenceNo: string | null; title: string | null; reason: string };
export type BulkOutcome = { done: { id: string; referenceNo: string | null; title: string }[]; skipped: BulkSkip[] };

const SKIP = {
  unavailable: "الطلب غير متاح لك.",
  notOpen: "لا يُعاد إسناد إلا الطلبات المفتوحة (مقدَّم أو قيد المراجعة أو معاد للتعديل).",
  sameSupervisor: "الطلب مسند إلى هذا المشرف أصلًا.",
  notOnTrack: "المشرف المختار لا يشرف على مسار هذا الطلب.",
} as const;

/** Unit manager: reassigns one or more open requests to an active supervisor of each request's track. */
export async function reassignRequests(actor: Actor, ids: readonly string[], toUserId: string, reasonInput: string): Promise<Result<{ outcome: BulkOutcome }>> {
  assertCan(actor, "requests.assign");
  const reason = reasonSchema.safeParse(reasonInput);
  if (!reason.success) return refuse(reason.error.issues[0].message, { reason: reason.error.issues[0].message });
  const unique = [...new Set(ids)];
  if (unique.length === 0) return refuse("لم يُحدَّد أي طلب.");
  const max = await getSetting("bulk.maxItems");
  if (unique.length > max) return refuse(bulkLimitMessage(max));
  const target = await db.user.findFirst({ where: { id: toUserId, role: "SUPERVISOR", isActive: true }, select: { id: true, name: true } });
  if (!target) return refuse("اختر مشرفًا نشطًا.", { toUserId: "اختر مشرفًا نشطًا." });

  const openIds = await statusIds(OPEN_STATUS_KEYS);
  const outcome: BulkOutcome = { done: [], skipped: [] };
  for (const id of unique) {
    const result = await db.$transaction(async (tx) => {
      const request = await tx.request.findFirst({
        where: { id, referenceNo: { not: null } },
        select: { id: true, referenceNo: true, title: true, trackId: true, statusId: true, assignedSupervisorId: true },
      });
      if (!request) return { skip: { id, referenceNo: null, title: null, reason: SKIP.unavailable } };
      const skip = (reason: string) => ({ skip: { id, referenceNo: request.referenceNo, title: request.title, reason } });
      if (!openIds.includes(request.statusId)) return skip(SKIP.notOpen);
      if (request.assignedSupervisorId === toUserId) return skip(SKIP.sameSupervisor);
      if (!(await isActiveSupervisorOf(tx, toUserId, request.trackId))) return skip(SKIP.notOnTrack);
      await lockTrack(tx, request.trackId);
      const moved = await tx.request.updateMany({
        where: { id, statusId: request.statusId, assignedSupervisorId: request.assignedSupervisorId },
        data: { assignedSupervisorId: toUserId },
      });
      if (moved.count !== 1) return skip("تغيّر الطلب أثناء التنفيذ؛ أعد المحاولة.");
      await tx.assignmentHistory.create({
        data: { requestId: id, fromUserId: request.assignedSupervisorId, toUserId, actorId: actor.id, reason: reason.data },
      });
      await audit(
        {
          actorId: actor.id,
          action: "request.reassigned",
          entityType: "Request",
          entityId: id,
          before: { assignedSupervisorId: request.assignedSupervisorId },
          after: { ...requestRef(request), assignedSupervisorId: toUserId, reason: reason.data },
        },
        tx,
      );
      const body = `${request.referenceNo ?? ""} — ${request.title}`;
      await notify(tx, [toUserId], { type: "request.assigned", title: "أُسند إليك طلب للمراجعة", body, requestId: id }, actor.id);
      await notify(tx, [request.assignedSupervisorId], { type: "request.reassigned_away", title: "أُعيد إسناد طلب كان لديك", body, requestId: id }, actor.id);
      return { done: { id, referenceNo: request.referenceNo, title: request.title } };
    });
    if ("done" in result && result.done) outcome.done.push(result.done);
    else if ("skip" in result && result.skip) outcome.skipped.push(result.skip);
  }
  return { ok: true, outcome };
}

/** Data for the unit manager's «الإسناد» screen. */
export async function assignmentOverview(actor: Actor) {
  assertCan(actor, "requests.assign");
  const openIds = await statusIds(OPEN_STATUS_KEYS);
  const [unassigned, inactiveAssigned, tracks] = await Promise.all([
    db.request.findMany({
      where: { referenceNo: { not: null }, statusId: { in: openIds }, assignedSupervisorId: null },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      take: 200,
      select: {
        id: true,
        referenceNo: true,
        title: true,
        submittedAt: true,
        slaDueAt: true,
        trackId: true,
        track: { select: { number: true, name: true } },
        association: { select: { name: true } },
        status: { select: { key: true, name: true, colorToken: true } },
      },
    }),
    db.request.findMany({
      where: { referenceNo: { not: null }, statusId: { in: openIds }, assignedSupervisor: { isActive: false } },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      take: 200,
      select: {
        id: true,
        referenceNo: true,
        title: true,
        submittedAt: true,
        slaDueAt: true,
        trackId: true,
        track: { select: { number: true, name: true } },
        association: { select: { name: true } },
        status: { select: { key: true, name: true, colorToken: true } },
        assignedSupervisor: { select: { name: true } },
      },
    }),
    db.track.findMany({ where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { number: "asc" }], select: { id: true, number: true, name: true } }),
  ]);
  const loads = await Promise.all(tracks.map(async (t) => ({ track: t, supervisors: await rankedSupervisors(db, t.id) })));
  return { unassigned, inactiveAssigned, loads };
}

/** Active supervisors with their tracks, for the reassignment pickers. */
export async function supervisorOptions(actor: Actor) {
  assertCan(actor, "requests.assign");
  const supervisors = await db.user.findMany({
    where: { role: "SUPERVISOR", isActive: true },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, supervisedTracks: { select: { trackId: true } } },
  });
  return supervisors.map((s) => ({ id: s.id, name: s.name, trackIds: s.supervisedTracks.map((t) => t.trackId) }));
}
