import "server-only";
import { checkCompleteness, type MissingItem } from "@/lib/completeness";
import { hijriYear } from "@/lib/format";
import { formatReference, parseCustomValues, type RequirementSpec } from "@/lib/requests";
import { addWorkingDays, riyadhDateString } from "@/lib/working-days";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { assertCan, refuse, type Refusal } from "@/server/services/admin/common";
import { audit } from "@/server/services/audit";
import { notify } from "@/server/services/notifications";
import { getSetting } from "@/server/settings/read";
import { assignOnSubmission } from "./assignment";
import { LIFECYCLE_BLOCKED, statusMap, transitionAllowed, WorkflowRefusal, type Tx } from "./common";
import { REQUEST_MSG } from "./drafts";

// Submission (brief §7, change 11; D-123). One transaction: the completeness check against the
// requirements as they stand now (persisted whether it passes or not, ranBy RULES); on success the
// reference number, the status history draft (or returned) → submitted → completeness check →
// under review, the requirements snapshot, submittedAt (first submission), the SLA due date in
// working days and the assignment. The row is claimed first with a conditional update, so a second
// click or a parallel submission finds the status already changed.

export type SubmitResult = { ok: true; referenceNo: string } | (Refusal & { missing?: MissingItem[] });

export const ALREADY_SUBMITTED = "قُدِّم هذا الطلب مسبقًا، فلا يمكن تقديمه مرة أخرى الآن.";
export const BLOCKED_MESSAGE = "لم يُقدَّم الطلب لأن بعض البيانات أو المرفقات ناقصة:";

/** Next RF-<hijriYear>-<seq>: one atomic upsert on the year's counter row. */
export async function nextReference(tx: Tx, now: Date): Promise<string> {
  const year = hijriYear(now);
  const rows = await tx.$queryRaw<{ lastSeq: number }[]>`
    INSERT INTO "reference_counters" ("hijriYear", "lastSeq") VALUES (${year}, 1)
    ON CONFLICT ("hijriYear") DO UPDATE SET "lastSeq" = "reference_counters"."lastSeq" + 1
    RETURNING "lastSeq"`;
  return formatReference(year, Number(rows[0].lastSeq));
}

export async function submitRequest(actor: Actor, id: string, now: Date = new Date()): Promise<SubmitResult> {
  assertCan(actor, "requests.editDraft");
  if (!actor.associationId) return refuse(REQUEST_MSG.notFound);
  const associationId = actor.associationId;
  const [allowedGroups, slaDays] = await Promise.all([getSetting("uploads.allowedGroups"), getSetting("sla.workingDays")]);

  try {
    return await db.$transaction(async (tx): Promise<SubmitResult> => {
      const statuses = await statusMap(tx);
      const current = await tx.request.findFirst({ where: { id, associationId }, select: { statusId: true } });
      if (!current) return refuse(REQUEST_MSG.notFound);
      const from = current.statusId === statuses.DRAFT.id ? statuses.DRAFT : current.statusId === statuses.RETURNED.id ? statuses.RETURNED : null;
      if (!from) return refuse(ALREADY_SUBMITTED);
      // Claim the row: a parallel submission waits here and then finds the status changed.
      const claimed = await tx.request.updateMany({ where: { id, associationId, statusId: from.id }, data: { updatedAt: now } });
      if (claimed.count !== 1) return refuse(ALREADY_SUBMITTED);

      const request = await tx.request.findUniqueOrThrow({
        where: { id },
        include: {
          association: { select: { isActive: true } },
          track: { select: { name: true, archivedAt: true } },
          requestType: { select: { name: true, isActive: true, archivedAt: true } },
          attachments: { where: { ownerType: "REQUEST" }, select: { attachmentType: { select: { key: true } }, currentVersion: { select: { mime: true } } } },
        },
      });
      // Initiative requirements no longer apply: the association chooses no initiative (D-123).
      const requirements: RequirementSpec[] = [];
      const firstSubmission = request.referenceNo === null;
      const missing = checkCompleteness({
        general: request,
        custom: parseCustomValues(request.customFields),
        requirements,
        files: request.attachments.filter((a) => a.currentVersion).map((a) => ({ typeKey: a.attachmentType?.key ?? null, mime: a.currentVersion!.mime })),
        allowedGroups,
        availability: {
          associationActive: request.association.isActive,
          track: request.track ? { name: request.track.name, available: !request.track.archivedAt } : null,
          requestType: request.requestType ? { name: request.requestType.name, available: request.requestType.isActive && !request.requestType.archivedAt } : null,
        },
        firstSubmission,
        today: riyadhDateString(now),
      });

      await tx.completenessCheck.create({ data: { requestId: id, passed: missing.length === 0, missing, ranBy: "RULES", createdAt: now } });
      if (missing.length) {
        await audit(
          {
            actorId: actor.id,
            action: "request.submission_blocked",
            entityType: "Request",
            entityId: id,
            after: { referenceNo: request.referenceNo, missing: missing.map((m) => ({ code: m.code, field: m.field })) },
          },
          tx,
        );
        return { ok: false, message: BLOCKED_MESSAGE, missing };
      }

      const allowed =
        (await transitionAllowed(tx, from.id, statuses.SUBMITTED.id, actor.role)) &&
        (await transitionAllowed(tx, statuses.SUBMITTED.id, statuses.COMPLETENESS_CHECK.id, "system")) &&
        (await transitionAllowed(tx, statuses.COMPLETENESS_CHECK.id, statuses.UNDER_REVIEW.id, "system"));
      if (!allowed) throw new WorkflowRefusal(LIFECYCLE_BLOCKED);

      const referenceNo = request.referenceNo ?? (await nextReference(tx, now));
      const at = (ms: number) => new Date(now.getTime() + ms);
      await tx.requestStatusHistory.createMany({
        data: [
          { requestId: id, fromStatusId: from.id, toStatusId: statuses.SUBMITTED.id, actorId: actor.id, note: firstSubmission ? null : "إعادة تقديم بعد التعديل", createdAt: at(0) },
          { requestId: id, fromStatusId: statuses.SUBMITTED.id, toStatusId: statuses.COMPLETENESS_CHECK.id, actorId: null, createdAt: at(1) },
          { requestId: id, fromStatusId: statuses.COMPLETENESS_CHECK.id, toStatusId: statuses.UNDER_REVIEW.id, actorId: null, note: "اجتاز فحص الاكتمال", createdAt: at(2) },
        ],
      });
      const slaDueAt = addWorkingDays(now, slaDays);
      await tx.request.update({
        where: { id },
        data: {
          statusId: statuses.UNDER_REVIEW.id,
          referenceNo,
          submittedAt: request.submittedAt ?? now,
          slaDueAt,
          decidedAt: null,
          requirementsSnapshot: requirements,
        },
      });
      const supervisorId = await assignOnSubmission(tx, { ...request, referenceNo }, actor.id);
      if (!firstSubmission && supervisorId && supervisorId === request.assignedSupervisorId) {
        await notify(tx, [supervisorId], { type: "request.resubmitted", title: "أُعيد تقديم طلب بعد التعديل", body: `${referenceNo} — ${request.title}`, requestId: id }, actor.id);
      }
      await audit(
        {
          actorId: actor.id,
          action: firstSubmission ? "request.submitted" : "request.resubmitted",
          entityType: "Request",
          entityId: id,
          before: { status: from.key },
          after: { referenceNo, title: request.title, status: "UNDER_REVIEW", slaDueAt: slaDueAt.toISOString(), assignedSupervisorId: supervisorId },
        },
        tx,
      );
      return { ok: true, referenceNo };
    });
  } catch (error) {
    if (error instanceof WorkflowRefusal) return refuse(error.message);
    throw error;
  }
}
