import "server-only";
import { DECISION_STATUS, type Decision } from "@/lib/requests";
import { reasonSchema } from "@/lib/validation/requests";
import { can } from "@/server/authz/permissions";
import { scopeRequests, type Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { assertCan, refuse, type Result } from "@/server/services/admin/common";
import { audit } from "@/server/services/audit";
import { notify, type NotificationType } from "@/server/services/notifications";
import { getSetting } from "@/server/settings/read";
import { bulkLimitMessage, type BulkOutcome } from "./assignment";
import { associationRecipients, requestRef, statusMap, transitionAllowed } from "./common";

// Review decisions (change 16, 18; D-070). Approve, return for amendment (reason required) or
// reject (reason required), for one request or a bulk selection with one shared reason. Only the
// assigned supervisor and the unit manager decide, and only requests under review inside their
// scope. Each request is decided in its own transaction with its own status history, audit entry
// and notification; the status is changed with a conditional update, so a double click or a
// concurrent decision finds the request no longer under review and is reported as skipped.

const SKIP = {
  unavailable: "الطلب غير متاح لك.",
  notUnderReview: "الطلب ليس قيد المراجعة.",
  notAssigned: "الطلب غير مسند إليك؛ يقرر فيه المشرف المسند إليه أو مدير الوحدة.",
  lifecycle: "دورة حياة الطلب لا تسمح بهذا الإجراء.",
  changed: "تغيّرت حالة الطلب قبل تنفيذ الإجراء.",
} as const;

const NOTIFY: Record<Decision, { type: NotificationType; title: string }> = {
  approve: { type: "request.approved", title: "اعتُمد طلبكم" },
  return: { type: "request.returned", title: "أُعيد طلبكم للتعديل" },
  reject: { type: "request.rejected", title: "رُفض طلبكم" },
};

const AUDIT_ACTION: Record<Decision, string> = { approve: "request.approved", return: "request.returned", reject: "request.rejected" };

/** Whether this actor may decide on a request with this assignment (D-070). */
export function isDecider(actor: Actor, assignedSupervisorId: string | null): boolean {
  if (!can(actor.role, "requests.review")) return false;
  if (actor.role === "UNIT_MANAGER") return true;
  return actor.role === "SUPERVISOR" && assignedSupervisorId === actor.id;
}

export async function decideRequests(actor: Actor, ids: readonly string[], decision: Decision, reasonInput = ""): Promise<Result<{ outcome: BulkOutcome }>> {
  assertCan(actor, "requests.review");
  let reason: string | null = null;
  if (decision !== "approve") {
    const parsed = reasonSchema.safeParse(reasonInput);
    if (!parsed.success) return refuse(parsed.error.issues[0].message, { reason: parsed.error.issues[0].message });
    reason = parsed.data;
  } else if (reasonInput.trim()) {
    const parsed = reasonSchema.safeParse(reasonInput);
    if (!parsed.success) return refuse(parsed.error.issues[0].message, { reason: parsed.error.issues[0].message });
    reason = parsed.data;
  }
  const unique = [...new Set(ids)];
  if (unique.length === 0) return refuse("لم يُحدَّد أي طلب.");
  const max = await getSetting("bulk.maxItems");
  if (unique.length > max) return refuse(bulkLimitMessage(max));

  const statuses = await statusMap();
  const target = statuses[DECISION_STATUS[decision]];
  const scope = scopeRequests(actor, "requests.review");
  const outcome: BulkOutcome = { done: [], skipped: [] };

  for (const id of unique) {
    const result = await db.$transaction(async (tx) => {
      const request = await tx.request.findFirst({
        where: { AND: [scope, { id }] },
        select: { id: true, referenceNo: true, title: true, statusId: true, associationId: true, assignedSupervisorId: true },
      });
      if (!request) return { skip: { id, referenceNo: null, title: null, reason: SKIP.unavailable } };
      const skip = (why: string) => ({ skip: { id, referenceNo: request.referenceNo, title: request.title, reason: why } });
      if (request.statusId !== statuses.UNDER_REVIEW.id) return skip(SKIP.notUnderReview);
      if (!isDecider(actor, request.assignedSupervisorId)) return skip(SKIP.notAssigned);
      if (!(await transitionAllowed(tx, statuses.UNDER_REVIEW.id, target.id, actor.role))) return skip(SKIP.lifecycle);

      const now = new Date();
      const changed = await tx.request.updateMany({
        where: {
          id,
          statusId: statuses.UNDER_REVIEW.id,
          ...(actor.role === "SUPERVISOR" ? { assignedSupervisorId: actor.id } : {}),
        },
        data: { statusId: target.id, decidedAt: target.isTerminal ? now : null },
      });
      if (changed.count !== 1) return skip(SKIP.changed);

      await tx.requestStatusHistory.create({
        data: { requestId: id, fromStatusId: statuses.UNDER_REVIEW.id, toStatusId: target.id, actorId: actor.id, note: reason, createdAt: now },
      });
      await audit(
        {
          actorId: actor.id,
          action: AUDIT_ACTION[decision],
          entityType: "Request",
          entityId: id,
          before: { status: "UNDER_REVIEW" },
          after: { ...requestRef(request), status: target.key, reason },
        },
        tx,
      );
      await notify(
        tx,
        await associationRecipients(tx, request.associationId),
        { ...NOTIFY[decision], body: `${request.referenceNo ?? ""} — ${request.title}`, requestId: id },
        actor.id,
      );
      return { done: { id, referenceNo: request.referenceNo, title: request.title } };
    });
    if ("done" in result && result.done) outcome.done.push(result.done);
    else if ("skip" in result && result.skip) outcome.skipped.push(result.skip);
  }
  return { ok: true, outcome };
}
