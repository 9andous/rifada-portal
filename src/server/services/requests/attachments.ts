import "server-only";
import type { Readable } from "node:stream";
import { acceptedGroups } from "@/lib/completeness";
import { arabicList, formatFileSize } from "@/lib/format";
import { FILE_TYPES } from "@/lib/uploads";
import { UPLOAD_GROUP_LABELS } from "@/lib/validation/settings";
import { can } from "@/server/authz/permissions";
import { scopeRequests, type Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { fieldRefusal, refuse, type Result } from "@/server/services/admin/common";
import { audit } from "@/server/services/audit";
import { getSetting } from "@/server/settings/read";
import { getStorage } from "@/server/storage/storage";
import { consumeUpload, NOT_USABLE, peekUpload, type ConsumedUpload, type StagedMeta } from "@/server/uploads/stage";
import { liveRequirements, requestRef, statusMap, type Client } from "./common";
import { REQUEST_MSG } from "./drafts";

// Request files (D-074, D-075, D-081). Officers attach files to a requirement of their own draft or
// returned request; each file keeps its versions. Staff and officers attach files to comments.
// Staged uploads are bound to the request (`request:<id>`) and consumed once by their uploader.
// Files are read only through `requestFile`, which applies the request scope, draft privacy and
// the internal-note rule.

const MB = 1024 * 1024;

export const uploadContext = (requestId: string) => `request:${requestId}`;

export type UploadPurpose = "request" | "comment";

const FILE_MSG = {
  notAllowed: "لا يمكن رفع ملفات إلى هذا الطلب.",
  requirementUnknown: "هذا المرفق ليس من متطلبات المبادرة.",
  attachmentUnknown: "الملف غير موجود في هذا الطلب.",
  sameFile: "الملف الجديد مطابق تمامًا للإصدار الحالي، فلم يُنشأ إصدار جديد.",
  draftOnlyRemoval: "لا تُحذف الملفات إلا من مسودة لم تُقدَّم قط؛ أضف إصدارًا جديدًا بدلًا من ذلك.",
} as const;

/** The request may receive uploads of this purpose from this actor (checked before any byte is staged). */
export async function canUploadTo(actor: Actor, requestId: string, purpose: UploadPurpose): Promise<boolean> {
  if (!can(actor.role, "attachments.upload")) return false;
  if (purpose === "request") {
    if (actor.role !== "ASSOCIATION_OFFICER" || !actor.associationId) return false;
    const statuses = await statusMap();
    const request = await db.request.findFirst({
      where: { id: requestId, associationId: actor.associationId, statusId: { in: [statuses.DRAFT.id, statuses.RETURNED.id] }, association: { isActive: true } },
      select: { id: true },
    });
    return Boolean(request);
  }
  if (!can(actor.role, "comments.write")) return false;
  const request = await db.request.findFirst({ where: { AND: [scopeRequests(actor, "comments.write"), { id: requestId, referenceNo: { not: null } }] }, select: { id: true } });
  return Boolean(request);
}

/** Bytes stored for an association's requests by its officer: every version, drafts included (D-075). */
export async function associationUsage(client: Client, associationId: string): Promise<number> {
  const sum = await client.attachmentVersion.aggregate({
    where: { attachment: { request: { associationId } }, uploadedBy: { role: "ASSOCIATION_OFFICER" } },
    _sum: { size: true },
  });
  return sum._sum.size ?? 0;
}

export async function quotaRefusal(associationId: string, adding: number): Promise<string | null> {
  const quotaMb = await getSetting("uploads.associationQuotaMb");
  const used = await associationUsage(db, associationId);
  if (used + adding <= quotaMb * MB) return null;
  return `تجاوز هذا الملف حد التخزين المخصص للجمعية (المستخدم ${formatFileSize(used)} من ${formatFileSize(quotaMb * MB)}). تواصلوا مع إدارة المنصة.`;
}

/** Validates a staged file against a requirement's accepted types (before consuming it). */
async function checkStagedType(meta: StagedMeta, requirement: Parameters<typeof acceptedGroups>[0]): Promise<string | null> {
  const groups = acceptedGroups(requirement, await getSetting("uploads.allowedGroups"));
  if (groups.includes(FILE_TYPES[meta.ext].group)) return null;
  return `نوع الملف غير مقبول لهذا المرفق. الأنواع المقبولة: ${arabicList(groups.map((g) => UPLOAD_GROUP_LABELS[g]))}.`;
}

/** Runs `write` with a consumed upload; if the write is refused or fails, the moved file is removed. */
export async function withConsumed<T extends object>(
  actor: Actor,
  uploadId: string,
  requestId: string,
  write: (file: ConsumedUpload) => Promise<Result<T>>,
): Promise<Result<T>> {
  const consumed = await consumeUpload(actor.id, uploadId, "attachments", Date.now(), uploadContext(requestId));
  if (!consumed.ok) return fieldRefusal("file", consumed.message);
  try {
    const result = await write(consumed.file);
    if (!result.ok) await getStorage().remove(consumed.file.storageKey);
    return result;
  } catch (error) {
    await getStorage().remove(consumed.file.storageKey);
    throw error;
  }
}

const fileSnapshot = (f: { fileName: string; size: number; sha256: string }, version: number) => ({ fileName: f.fileName, size: f.size, sha256: f.sha256, version });

/** Adds a new file to an attachment requirement of the officer's editable request. */
export async function attachRequirementFile(actor: Actor, requestId: string, requirementKey: string, uploadId: string): Promise<Result<{ attachmentId: string }>> {
  if (!(await canUploadTo(actor, requestId, "request")) || !actor.associationId) return refuse(FILE_MSG.notAllowed);
  const associationId = actor.associationId;
  const request = await db.request.findUniqueOrThrow({ where: { id: requestId }, select: { initiativeId: true, statusId: true, referenceNo: true, title: true } });
  const requirement = (await liveRequirements(db, request.initiativeId)).find((r) => r.kind === "ATTACHMENT" && r.key === requirementKey);
  if (!requirement?.attachmentType) return refuse(FILE_MSG.requirementUnknown);
  const meta = await peekUpload(actor.id, uploadId, uploadContext(requestId));
  if (!meta) return fieldRefusal("file", NOT_USABLE);
  const typeProblem = await checkStagedType(meta, requirement);
  if (typeProblem) return fieldRefusal("file", typeProblem);
  const quota = await quotaRefusal(associationId, meta.size);
  if (quota) return fieldRefusal("file", quota);
  const type = await db.attachmentType.findUnique({ where: { key: requirement.attachmentType.key }, select: { id: true } });
  if (!type) return refuse(FILE_MSG.requirementUnknown);

  return withConsumed(actor, uploadId, requestId, (file) =>
    db.$transaction(async (tx) => {
      const still = await tx.request.findFirst({ where: { id: requestId, associationId, statusId: request.statusId }, select: { id: true } });
      if (!still) return refuse(REQUEST_MSG.notEditable);
      const attachment = await tx.attachment.create({
        data: { ownerType: "REQUEST", requestId, attachmentTypeId: type.id, title: file.fileName, uploadedById: actor.id },
      });
      const version = await tx.attachmentVersion.create({ data: { attachmentId: attachment.id, versionNo: 1, ...file, uploadedById: actor.id } });
      await tx.attachment.update({ where: { id: attachment.id }, data: { currentVersionId: version.id } });
      await audit(
        {
          actorId: actor.id,
          action: "request.file_added",
          entityType: "Request",
          entityId: requestId,
          after: { ...requestRef(request), requirementKey, attachmentId: attachment.id, file: fileSnapshot(file, 1) },
        },
        tx,
      );
      return { ok: true, attachmentId: attachment.id };
    }),
  );
}

/** Adds a new version to one of the request's requirement files; the earlier versions stay. */
export async function addAttachmentVersion(actor: Actor, requestId: string, attachmentId: string, uploadId: string): Promise<Result<{ version: number }>> {
  if (!(await canUploadTo(actor, requestId, "request")) || !actor.associationId) return refuse(FILE_MSG.notAllowed);
  const associationId = actor.associationId;
  const attachment = await db.attachment.findFirst({
    where: { id: attachmentId, requestId, ownerType: "REQUEST" },
    select: { id: true, attachmentType: { select: { key: true, name: true, allowedMimeGroups: true } }, request: { select: { statusId: true, referenceNo: true, title: true } } },
  });
  if (!attachment) return refuse(FILE_MSG.attachmentUnknown);
  const meta = await peekUpload(actor.id, uploadId, uploadContext(requestId));
  if (!meta) return fieldRefusal("file", NOT_USABLE);
  const at = attachment.attachmentType;
  const typeProblem = await checkStagedType(meta, { attachmentType: at ? { key: at.key, name: at.name, groups: at.allowedMimeGroups } : null });
  if (typeProblem) return fieldRefusal("file", typeProblem);
  const quota = await quotaRefusal(associationId, meta.size);
  if (quota) return fieldRefusal("file", quota);

  return withConsumed(actor, uploadId, requestId, (file) =>
    db.$transaction(async (tx) => {
      const still = await tx.request.findFirst({ where: { id: requestId, associationId, statusId: attachment.request.statusId }, select: { id: true } });
      if (!still) return refuse(REQUEST_MSG.notEditable);
      const current = await tx.attachment.findUniqueOrThrow({ where: { id: attachmentId }, select: { currentVersion: { select: { sha256: true, versionNo: true } } } });
      if (current.currentVersion?.sha256 === file.sha256) return fieldRefusal("file", FILE_MSG.sameFile);
      const last = await tx.attachmentVersion.aggregate({ where: { attachmentId }, _max: { versionNo: true } });
      const versionNo = (last._max.versionNo ?? 0) + 1;
      const version = await tx.attachmentVersion.create({ data: { attachmentId, versionNo, ...file, uploadedById: actor.id } });
      await tx.attachment.update({ where: { id: attachmentId }, data: { currentVersionId: version.id, title: file.fileName } });
      await audit(
        {
          actorId: actor.id,
          action: "request.file_version_added",
          entityType: "Request",
          entityId: requestId,
          after: { ...requestRef(attachment.request), attachmentId, file: fileSnapshot(file, versionNo) },
        },
        tx,
      );
      return { ok: true, version: versionNo };
    }),
  );
}

/** Removes a file and all its versions from a draft that was never submitted (D-083). */
export async function removeDraftAttachment(actor: Actor, requestId: string, attachmentId: string): Promise<Result> {
  if (actor.role !== "ASSOCIATION_OFFICER" || !actor.associationId || !can(actor.role, "requests.editDraft")) return refuse(FILE_MSG.notAllowed);
  const associationId = actor.associationId;
  const keys: string[] = [];
  const result = await db.$transaction(async (tx) => {
    const statuses = await statusMap(tx);
    const attachment = await tx.attachment.findFirst({
      where: { id: attachmentId, ownerType: "REQUEST", request: { id: requestId, associationId, referenceNo: null, statusId: statuses.DRAFT.id } },
      select: { id: true, versions: { select: { storageKey: true, fileName: true, size: true, sha256: true, versionNo: true } }, request: { select: { referenceNo: true, title: true } } },
    });
    if (!attachment) return refuse(FILE_MSG.draftOnlyRemoval);
    keys.push(...attachment.versions.map((v) => v.storageKey));
    await tx.attachment.update({ where: { id: attachmentId }, data: { currentVersionId: null } });
    await tx.attachment.delete({ where: { id: attachmentId } });
    await audit(
      {
        actorId: actor.id,
        action: "request.file_removed",
        entityType: "Request",
        entityId: requestId,
        before: { ...requestRef(attachment.request), attachmentId, files: attachment.versions.map((v) => fileSnapshot(v, v.versionNo)) },
      },
      tx,
    );
    return { ok: true } as const;
  });
  if (result.ok) for (const key of keys) await getStorage().remove(key);
  return result;
}

export type RequestFile = { stream: Readable; fileName: string; mime: string; size: number };

/**
 * A request or comment file for download, or null (answered 404). The request must be in the
 * actor's read scope (drafts only for their own association), and files of internal notes need
 * `comments.readInternal`. Super-admin downloads are audited (D-071).
 */
export async function requestFile(actor: Actor, requestId: string, versionId: string): Promise<RequestFile | null> {
  if (!can(actor.role, "attachments.read") || !can(actor.role, "requests.read")) return null;
  const version = await db.attachmentVersion.findFirst({
    where: { id: versionId, attachment: { requestId, request: scopeRequests(actor, "attachments.read") } },
    select: {
      storageKey: true,
      fileName: true,
      mime: true,
      versionNo: true,
      attachment: { select: { id: true, ownerType: true, comment: { select: { isInternal: true } }, request: { select: { referenceNo: true, title: true } } } },
    },
  });
  if (!version) return null;
  const { attachment } = version;
  if (attachment.ownerType === "COMMENT" && (!attachment.comment || (attachment.comment.isInternal && !can(actor.role, "comments.readInternal")))) return null;
  const storage = getStorage();
  const size = await storage.size(version.storageKey);
  if (actor.role === "SUPER_ADMIN") {
    await audit({
      actorId: actor.id,
      action: "request.file_downloaded_by_admin",
      entityType: "Request",
      entityId: requestId,
      after: { ...requestRef(attachment.request), attachmentId: attachment.id, fileName: version.fileName, version: version.versionNo },
    });
  }
  return { stream: storage.openRead(version.storageKey), fileName: version.fileName, mime: version.mime, size };
}
