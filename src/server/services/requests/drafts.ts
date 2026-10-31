import "server-only";
import { fieldErrors } from "@/lib/validation/auth";
import { draftSchema } from "@/lib/validation/requests";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { assertCan, fieldRefusal, refuse, type Result } from "@/server/services/admin/common";
import { audit } from "@/server/services/audit";
import { getStorage } from "@/server/storage/storage";
import { riyadhDateString } from "@/lib/working-days";
import { requestRef, statusMap } from "./common";

// Drafts (Phase 3): an officer creates a draft by choosing the track and the request type (D-123),
// saves and resumes it, and may delete it while it has never been submitted (D-073). The programme
// and initiatives are no longer the association's choice; the supervisor may set them in review.
// Returned requests are edited through the same save.

export const REQUEST_MSG = {
  notFound: "الطلب غير موجود.",
  notEditable: "لا يمكن تعديل الطلب في حالته الحالية.",
  associationInactive: "حساب الجمعية غير نشط، فلا يمكن إنشاء طلبات أو تعديلها.",
  trackMissing: "اختاروا المسار المستهدف.",
  trackUnavailable: "المسار المختار غير متاح حاليًا.",
  requestTypeMissing: "اختاروا نوع الطلب.",
  requestTypeUnavailable: "نوع الطلب المختار غير متاح حاليًا.",
  notDiscardable: "لا تُحذف إلا المسودات التي لم تُقدَّم قط.",
} as const;

async function activeAssociation(actor: Actor): Promise<boolean> {
  if (!actor.associationId) return false;
  const association = await db.association.findUnique({ where: { id: actor.associationId }, select: { isActive: true } });
  return Boolean(association?.isActive);
}

const availableTrackWhere = { archivedAt: null };
const availableRequestTypeWhere = { archivedAt: null, isActive: true };

/** The tracks and request types offered for a request (D-123). */
export async function newRequestOptions(actor: Actor) {
  assertCan(actor, "requests.create");
  const [tracks, requestTypes] = await Promise.all([
    db.track.findMany({ where: availableTrackWhere, orderBy: [{ sortOrder: "asc" }, { number: "asc" }], select: { id: true, number: true, name: true, description: true } }),
    db.requestType.findMany({ where: availableRequestTypeWhere, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, description: true } }),
  ]);
  return { tracks, requestTypes, associationActive: await activeAssociation(actor) };
}

/** Checks a track and request type choice; null when both are available. */
async function checkChoice(input: { trackId: string; requestTypeId: string }) {
  if (!input.trackId) return fieldRefusal("trackId", REQUEST_MSG.trackMissing);
  if (!input.requestTypeId) return fieldRefusal("requestTypeId", REQUEST_MSG.requestTypeMissing);
  if (!(await db.track.count({ where: { id: input.trackId, ...availableTrackWhere } }))) return fieldRefusal("trackId", REQUEST_MSG.trackUnavailable);
  if (!(await db.requestType.count({ where: { id: input.requestTypeId, ...availableRequestTypeWhere } }))) return fieldRefusal("requestTypeId", REQUEST_MSG.requestTypeUnavailable);
  return null;
}

/** The name is optional here: the association writes it on the next step (D-123). */
export async function createDraft(actor: Actor, input: { trackId: string; requestTypeId: string; title?: string }): Promise<Result<{ id: string }>> {
  assertCan(actor, "requests.create");
  if (!actor.associationId || !(await activeAssociation(actor))) return refuse(REQUEST_MSG.associationInactive);
  const title = (input.title ?? "").trim();
  if (title.length > 200) return fieldRefusal("title", "اسم المشروع أطول من الحد المسموح به (٢٠٠ حرف).");
  const refused = await checkChoice(input);
  if (refused) return refused;
  const associationId = actor.associationId;

  return db.$transaction(async (tx) => {
    const statuses = await statusMap(tx);
    const request = await tx.request.create({
      data: { associationId, trackId: input.trackId, requestTypeId: input.requestTypeId, statusId: statuses.DRAFT.id, title, createdById: actor.id },
    });
    await tx.requestStatusHistory.create({ data: { requestId: request.id, fromStatusId: null, toStatusId: statuses.DRAFT.id, actorId: actor.id } });
    await audit(
      { actorId: actor.id, action: "request.created", entityType: "Request", entityId: request.id, after: { title, trackId: input.trackId, requestTypeId: input.requestTypeId } },
      tx,
    );
    return { ok: true, id: request.id };
  });
}

/** The officer's own request in an editable status (draft or returned), or null. */
export async function editableRequest(actor: Actor, id: string) {
  if (!actor.associationId) return null;
  const statuses = await statusMap();
  return db.request.findFirst({
    where: { id, associationId: actor.associationId, statusId: { in: [statuses.DRAFT.id, statuses.RETURNED.id] } },
    select: { id: true, referenceNo: true, title: true, statusId: true, trackId: true, requestTypeId: true, assignedSupervisorId: true },
  });
}

const toDate = (value: string) => (value ? new Date(`${value}T00:00:00Z`) : null);

/** Saves the form (D-123): the track, the request type and the general fields. */
export async function saveDraft(actor: Actor, id: string, raw: unknown): Promise<Result> {
  assertCan(actor, "requests.editDraft");
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const input = parsed.data;
  if (!(await activeAssociation(actor))) return refuse(REQUEST_MSG.associationInactive);
  const request = await editableRequest(actor, id);
  if (!request) return refuse(REQUEST_MSG.notEditable);
  // Empty keeps the current choice. A track or type archived since it was chosen may stay; a new
  // choice must be available.
  const trackId = input.trackId || request.trackId || "";
  const requestTypeId = input.requestTypeId || request.requestTypeId || "";
  if (trackId !== request.trackId || requestTypeId !== request.requestTypeId) {
    const refused = await checkChoice({ trackId, requestTypeId });
    if (refused) return refused;
  }

  // The period is checked as it is typed (D-123): the start not before today (a start already
  // saved is left alone), the end not before the start.
  const stored = await db.request.findUnique({ where: { id }, select: { startDate: true } });
  const storedStart = stored?.startDate ? stored.startDate.toISOString().slice(0, 10) : "";
  if (input.startDate && input.startDate !== storedStart && input.startDate < riyadhDateString(new Date())) {
    return fieldRefusal("startDate", "تاريخ البداية يجب أن يكون اليوم أو بعده.");
  }
  if (input.startDate && input.endDate && input.endDate < input.startDate) return fieldRefusal("endDate", "تاريخ النهاية يجب ألا يسبق تاريخ البداية.");

  return db.$transaction(async (tx) => {
    const before = await tx.request.findFirst({ where: { id, statusId: request.statusId } });
    if (!before) return refuse(REQUEST_MSG.notEditable);
    const data = {
      trackId: trackId || null,
      requestTypeId: requestTypeId || null,
      title: input.title,
      description: input.description || null,
      goals: input.goals || null,
      expectedBeneficiaries: input.expectedBeneficiaries || null,
      startDate: toDate(input.startDate),
      endDate: toDate(input.endDate),
      estimatedBudget: input.estimatedBudget,
      kpis: input.kpis || null,
      partners: input.partners || null,
    };
    await tx.request.update({ where: { id }, data });
    const changed = [
      ...(["trackId", "requestTypeId", "title", "description", "goals", "kpis", "partners", "expectedBeneficiaries", "estimatedBudget"] as const).filter((k) => (before[k] ?? "") !== (data[k] ?? "")),
      ...(["startDate", "endDate"] as const).filter((k) => (before[k]?.getTime() ?? null) !== (data[k]?.getTime() ?? null)),
    ];
    if (changed.length) {
      await audit({ actorId: actor.id, action: "request.saved", entityType: "Request", entityId: id, after: { ...requestRef({ referenceNo: before.referenceNo, title: data.title }), changed } }, tx);
    }
    return { ok: true };
  });
}

/** Deletes a draft that was never submitted, with its files (D-073). */
export async function discardDraft(actor: Actor, id: string): Promise<Result> {
  assertCan(actor, "requests.editDraft");
  if (!actor.associationId) return refuse(REQUEST_MSG.notFound);
  const associationId = actor.associationId;
  const keys: string[] = [];
  const result = await db.$transaction(async (tx) => {
    const statuses = await statusMap(tx);
    const request = await tx.request.findFirst({
      where: { id, associationId, referenceNo: null, statusId: statuses.DRAFT.id },
      include: {
        program: { select: { number: true, name: true } },
        initiative: { select: { number: true, name: true } },
        attachments: { include: { versions: { select: { storageKey: true, fileName: true, sha256: true, versionNo: true } } } },
      },
    });
    if (!request) return refuse(REQUEST_MSG.notDiscardable);
    const files = request.attachments.flatMap((a) => a.versions.map((v) => ({ fileName: v.fileName, sha256: v.sha256, version: v.versionNo })));
    keys.push(...request.attachments.flatMap((a) => a.versions.map((v) => v.storageKey)));
    await tx.attachment.updateMany({ where: { requestId: id }, data: { currentVersionId: null } });
    const deleted = await tx.request.deleteMany({ where: { id, referenceNo: null, statusId: statuses.DRAFT.id } });
    if (deleted.count !== 1) return refuse(REQUEST_MSG.notDiscardable);
    await audit(
      {
        actorId: actor.id,
        action: "request.draft_discarded",
        entityType: "Request",
        entityId: id,
        before: { title: request.title, program: request.program, initiative: request.initiative, files },
      },
      tx,
    );
    return { ok: true } as const;
  });
  if (result.ok) {
    const storage = getStorage();
    for (const key of keys) await storage.remove(key);
  }
  return result;
}
