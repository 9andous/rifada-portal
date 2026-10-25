import "server-only";
import { parseCustomValues } from "@/lib/requests";
import { fieldErrors } from "@/lib/validation/auth";
import { draftSchema } from "@/lib/validation/requests";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { assertCan, fieldRefusal, refuse, type Result } from "@/server/services/admin/common";
import { audit } from "@/server/services/audit";
import { availableInitiativeWhere } from "@/server/services/taxonomy";
import { getStorage } from "@/server/storage/storage";
import { liveRequirements, requestRef, statusMap } from "./common";

// Drafts (Phase 3): an officer creates a draft by choosing an available program and initiative
// (fixed afterwards, D-083), saves and resumes it, and may delete it while it has never been
// submitted (D-073). Returned requests are edited through the same save.

export const REQUEST_MSG = {
  notFound: "الطلب غير موجود.",
  notEditable: "لا يمكن تعديل الطلب في حالته الحالية.",
  associationInactive: "حساب الجمعية غير نشط، فلا يمكن إنشاء طلبات أو تعديلها.",
  initiativeUnavailable: "المبادرة المختارة غير متاحة لتقديم الطلبات حاليًا.",
  initiativeOutsideProgram: "المبادرة المختارة لا تتبع البرنامج المختار.",
  notDiscardable: "لا تُحذف إلا المسودات التي لم تُقدَّم قط.",
} as const;

async function activeAssociation(actor: Actor): Promise<boolean> {
  if (!actor.associationId) return false;
  const association = await db.association.findUnique({ where: { id: actor.associationId }, select: { isActive: true } });
  return Boolean(association?.isActive);
}

/** Programs and their initiatives open for new requests (D-052), for the «طلب جديد» screen. */
export async function newRequestOptions(actor: Actor) {
  assertCan(actor, "requests.create");
  const programs = await db.program.findMany({
    where: { archivedAt: null, isActive: true, initiatives: { some: availableInitiativeWhere } },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      name: true,
      initiatives: { where: availableInitiativeWhere, orderBy: { number: "asc" }, select: { id: true, number: true, name: true } },
    },
  });
  return { programs, associationActive: await activeAssociation(actor) };
}

export async function createDraft(actor: Actor, input: { programId: string; initiativeId: string }): Promise<Result<{ id: string }>> {
  assertCan(actor, "requests.create");
  if (!actor.associationId || !(await activeAssociation(actor))) return refuse(REQUEST_MSG.associationInactive);
  const initiative = await db.initiative.findFirst({ where: { id: input.initiativeId, ...availableInitiativeWhere }, select: { id: true, programId: true } });
  if (!initiative) return fieldRefusal("initiativeId", REQUEST_MSG.initiativeUnavailable);
  if (initiative.programId !== input.programId) return fieldRefusal("initiativeId", REQUEST_MSG.initiativeOutsideProgram);
  const associationId = actor.associationId;

  return db.$transaction(async (tx) => {
    const statuses = await statusMap(tx);
    const request = await tx.request.create({
      data: { associationId, programId: initiative.programId, initiativeId: initiative.id, statusId: statuses.DRAFT.id, title: "", createdById: actor.id },
    });
    await tx.requestStatusHistory.create({ data: { requestId: request.id, fromStatusId: null, toStatusId: statuses.DRAFT.id, actorId: actor.id } });
    await audit(
      { actorId: actor.id, action: "request.created", entityType: "Request", entityId: request.id, after: { programId: request.programId, initiativeId: request.initiativeId } },
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
    select: { id: true, referenceNo: true, title: true, statusId: true, initiativeId: true, programId: true, customFields: true, assignedSupervisorId: true },
  });
}

const toDate = (value: string) => (value ? new Date(`${value}T00:00:00Z`) : null);

/**
 * Saves the general fields and the initiative's own fields. Only keys of the initiative's current
 * field requirements are written; stored values of other keys (removed requirements) are kept.
 */
export async function saveDraft(actor: Actor, id: string, raw: unknown): Promise<Result> {
  assertCan(actor, "requests.editDraft");
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const input = parsed.data;
  if (!(await activeAssociation(actor))) return refuse(REQUEST_MSG.associationInactive);
  const request = await editableRequest(actor, id);
  if (!request) return refuse(REQUEST_MSG.notEditable);

  const fieldKeys = new Set((await liveRequirements(db, request.initiativeId)).filter((r) => r.kind === "FIELD").map((r) => r.key));
  const custom = parseCustomValues(request.customFields);
  for (const [key, value] of Object.entries(input.custom)) if (fieldKeys.has(key)) custom[key] = value;

  return db.$transaction(async (tx) => {
    const before = await tx.request.findFirst({ where: { id, statusId: request.statusId } });
    if (!before) return refuse(REQUEST_MSG.notEditable);
    const data = {
      title: input.title,
      description: input.description || null,
      targetAudience: input.targetAudience || null,
      location: input.location || null,
      startDate: toDate(input.startDate),
      endDate: toDate(input.endDate),
      customFields: custom,
    };
    await tx.request.update({ where: { id }, data });
    const changed = [
      ...(["title", "description", "targetAudience", "location"] as const).filter((k) => (before[k] ?? "") !== (data[k] ?? "")),
      ...(["startDate", "endDate"] as const).filter((k) => (before[k]?.getTime() ?? null) !== (data[k]?.getTime() ?? null)),
      ...Object.keys(custom).filter((k) => parseCustomValues(before.customFields)[k] !== custom[k]).map((k) => `custom.${k}`),
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
