import "server-only";
import { DECISION_STATUS, type Decision } from "@/lib/requests";
import { reasonSchema } from "@/lib/validation/requests";
import { scopeRequests, type Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { createSeal } from "@/server/seal/seal";
import { assertCan, refuse, type Result } from "@/server/services/admin/common";
import { audit } from "@/server/services/audit";
import { notify, recordRequestAction, type NotificationType } from "@/server/services/notifications";
import { getSetting } from "@/server/settings/read";
import { bulkLimitMessage, type BulkOutcome } from "./assignment";
import { associationRecipients, recordTakeover, requestRef, statusMap, transitionAllowed } from "./common";

// Review decisions (change 16, 18; D-070, D-144). Approve, return for amendment (reason required) or
// reject (reason required), for one request or a bulk selection with one shared reason. Each request is decided in its own transaction with its own status history, audit entry
// and notification; the status is changed with a conditional update, so a double click or a
// concurrent decision finds the request no longer under review and is reported as skipped.
// Two-step review (D-116, D-139, D-145). Before evaluating, a supervisor of the track may return or reject
// directly, for wrong or incomplete data. Accepting goes through the signed evaluation (review.ts), whose
// recommendation of any of the three goes to the unit manager, who then takes the final decision and may
// overrule it. The manager decides only after that evaluation, except that with no active supervisor on
// the track nobody can evaluate the request, so the manager may return or reject it rather than leave it stuck.

const SKIP = {
  unavailable: "الطلب غير متاح لك.",
  notUnderReview: "الطلب ليس قيد المراجعة.",
  lifecycle: "دورة حياة الطلب لا تسمح بهذا الإجراء.",
  changed: "تغيّرت حالة الطلب قبل تنفيذ الإجراء.",
  evaluateFirst: "يُقبل الطلب عبر «تقييم واعتماد»، ثم يُرسل إلى مدير الوحدة.",
  withManager: "أُرسل الطلب إلى مدير الوحدة بعد تقييمه؛ القرار الآن له.",
  notEvaluated: "لم يرفع المشرف توصيته بعد؛ يقرر مدير الوحدة بعد تقييمه وتوقيعه.",
} as const;

const NOTIFY: Record<Decision, { type: NotificationType; title: string }> = {
  approve: { type: "request.approved", title: "اعتُمد طلبكم" },
  return: { type: "request.returned", title: "أُعيد طلبكم للتعديل" },
  reject: { type: "request.rejected", title: "رُفض طلبكم" },
};

const MANAGER_DECISION: Record<Decision, string> = { approve: "اعتماد الطلب", return: "إعادته إلى الجمعية للتعديل", reject: "رفض الطلب" };

const AUDIT_ACTION: Record<Decision, string> = { approve: "request.approved", return: "request.returned", reject: "request.rejected" };

/** The unit manager may return or reject now: a supervisor has evaluated, or the track has no active supervisor (D-139, D-144). */
export function managerMayDecide(reviewStage: "SUPERVISOR" | "MANAGER", track: { supervisors: unknown[] } | null): boolean {
  return reviewStage === "MANAGER" || !track?.supervisors.length;
}

/**
 * `approval`: the unit manager's password, already checked by approveRequests (review.ts); the
 * final approval is never given without it (D-117), and each approval is sealed (D-122).
 */
export async function decideRequests(
  actor: Actor,
  ids: readonly string[],
  decision: Decision,
  reasonInput = "",
  approval?: { passwordConfirmed: true },
): Promise<Result<{ outcome: BulkOutcome }>> {
  assertCan(actor, "requests.review");
  if (decision === "approve" && actor.role === "UNIT_MANAGER" && !approval) return refuse("يوقّع مدير الوحدة عند الاعتماد النهائي.");
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
        select: {
          id: true,
          referenceNo: true,
          title: true,
          statusId: true,
          associationId: true,
          assignedSupervisorId: true,
          reviewStage: true,
          track: { select: { supervisors: { where: { user: { isActive: true, role: "SUPERVISOR" } }, take: 1, select: { userId: true } } } },
          evaluations: { orderBy: { createdAt: "desc" }, take: 1, select: { recommendation: true } },
        },
      });
      if (!request) return { skip: { id, referenceNo: null, title: null, reason: SKIP.unavailable } };
      const skip = (why: string) => ({ skip: { id, referenceNo: request.referenceNo, title: request.title, reason: why } });
      if (request.statusId !== statuses.UNDER_REVIEW.id) return skip(SKIP.notUnderReview);
      if (actor.role === "SUPERVISOR" && decision === "approve") return skip(SKIP.evaluateFirst);
      if (actor.role === "SUPERVISOR" && request.reviewStage !== "SUPERVISOR") return skip(SKIP.withManager);
      if (actor.role === "UNIT_MANAGER" && (decision === "approve" ? request.reviewStage !== "MANAGER" : !managerMayDecide(request.reviewStage, request.track))) return skip(SKIP.notEvaluated);
      if (!(await transitionAllowed(tx, statuses.UNDER_REVIEW.id, target.id, actor.role))) return skip(SKIP.lifecycle);

      const now = new Date();
      const took = actor.role === "SUPERVISOR" && request.assignedSupervisorId !== actor.id;
      const changed = await tx.request.updateMany({
        where: {
          id,
          statusId: statuses.UNDER_REVIEW.id,
          reviewStage: request.reviewStage,
        },
        // A returned request starts its review again with the supervisor when resubmitted.
        data: { statusId: target.id, decidedAt: target.isTerminal ? now : null, reviewStage: "SUPERVISOR", ...(took ? { assignedSupervisorId: actor.id } : {}) },
      });
      if (changed.count !== 1) return skip(SKIP.changed);
      if (took) await recordTakeover(tx, actor.id, request, "بتّ في الطلب قبل تقييمه");

      await tx.requestStatusHistory.create({
        data: { requestId: id, fromStatusId: statuses.UNDER_REVIEW.id, toStatusId: target.id, actorId: actor.id, note: reason, createdAt: now },
      });
      await recordRequestAction(tx, actor.id, id);
      if (decision === "approve" && approval) {
        const approved = await tx.requestApproval.create({ data: { requestId: id, managerId: actor.id, createdAt: now } });
        await createSeal(tx, { kind: "APPROVAL", requestId: id, signerId: actor.id, approvalId: approved.id, at: now });
      }
      await audit(
        {
          actorId: actor.id,
          action: AUDIT_ACTION[decision],
          entityType: "Request",
          entityId: id,
          before: { status: "UNDER_REVIEW" },
          after: { ...requestRef(request), status: target.key, reason, recommendation: request.evaluations[0]?.recommendation ?? null },
        },
        tx,
      );
      await notify(
        tx,
        await associationRecipients(tx, request.associationId),
        { ...NOTIFY[decision], body: `${request.referenceNo ?? ""} — ${request.title}`, requestId: id },
        actor.id,
      );
      // The supervisor follows what the unit manager decided on a request they reviewed (D-116).
      if (actor.role === "UNIT_MANAGER") {
        await notify(
          tx,
          [request.assignedSupervisorId],
          { type: "request.manager_decided", title: `قرار مدير الوحدة: ${MANAGER_DECISION[decision]}`, body: `${request.referenceNo ?? ""} — ${request.title}`, requestId: id },
          actor.id,
        );
      }
      return { done: { id, referenceNo: request.referenceNo, title: request.title } };
    });
    if ("done" in result && result.done) outcome.done.push(result.done);
    else if ("skip" in result && result.skip) outcome.skipped.push(result.skip);
  }
  return { ok: true, outcome };
}
