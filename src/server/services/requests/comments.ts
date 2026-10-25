import "server-only";
import { REQUEST_LIMITS, commentBodySchema } from "@/lib/validation/requests";
import { toArabicDigits } from "@/lib/format";
import { can } from "@/server/authz/permissions";
import { scopeComments, scopeRequests, type Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { assertCan, fieldRefusal, refuse, type Result } from "@/server/services/admin/common";
import { audit } from "@/server/services/audit";
import { notify } from "@/server/services/notifications";
import { getStorage } from "@/server/storage/storage";
import { consumeUpload, NOT_USABLE, peekUpload, type ConsumedUpload } from "@/server/uploads/stage";
import { quotaRefusal, uploadContext } from "./attachments";
import { activeManagerIds, associationRecipients, requestRef } from "./common";

// Comments (brief §7, change 13, D-084). Threaded in the data (parentId), shown as a flat thread,
// immutable (no edit or delete). Internal notes are staff only: they are written only with
// `comments.writeInternal`, read only through `scopeComments` (which removes them for officers),
// never notified to officers, and a public reply to an internal note is refused. Comments are not
// possible on drafts.

export type CommentInput = { body: string; internal: boolean; parentId?: string | null; uploadIds?: string[] };

const MSG = {
  notAllowed: "لا يمكن إضافة تعليق على هذا الطلب.",
  parentUnknown: "التعليق الذي تردّ عليه غير موجود.",
  publicReplyToInternal: "لا يُرد على ملاحظة داخلية إلا بملاحظة داخلية.",
  tooManyFiles: `يمكن إرفاق ${toArabicDigits(REQUEST_LIMITS.commentFiles)} ملفات على الأكثر مع التعليق.`,
} as const;

export async function addComment(actor: Actor, requestId: string, input: CommentInput): Promise<Result<{ id: string }>> {
  assertCan(actor, "comments.write");
  if (input.internal) assertCan(actor, "comments.writeInternal");
  const body = commentBodySchema.safeParse(input.body);
  if (!body.success) return fieldRefusal("body", body.error.issues[0].message);
  const uploadIds = [...new Set(input.uploadIds ?? [])];
  if (uploadIds.length > REQUEST_LIMITS.commentFiles) return fieldRefusal("file", MSG.tooManyFiles);
  if (uploadIds.length > 0) assertCan(actor, "attachments.upload");

  const request = await db.request.findFirst({
    where: { AND: [scopeRequests(actor, "comments.write"), { id: requestId, referenceNo: { not: null } }] },
    select: { id: true, referenceNo: true, title: true, associationId: true, assignedSupervisorId: true },
  });
  if (!request) return refuse(MSG.notAllowed);

  let parent: { id: string; authorId: string; isInternal: boolean } | null = null;
  if (input.parentId) {
    parent = await db.comment.findFirst({ where: { AND: [scopeComments(actor), { id: input.parentId, requestId }] }, select: { id: true, authorId: true, isInternal: true } });
    if (!parent) return refuse(MSG.parentUnknown);
    if (parent.isInternal && !input.internal) return refuse(MSG.publicReplyToInternal);
  }

  // Validate every staged file before consuming any.
  let adding = 0;
  for (const uploadId of uploadIds) {
    const meta = await peekUpload(actor.id, uploadId, uploadContext(requestId));
    if (!meta) return fieldRefusal("file", NOT_USABLE);
    adding += meta.size;
  }
  if (actor.role === "ASSOCIATION_OFFICER" && adding > 0) {
    const quota = await quotaRefusal(request.associationId, adding);
    if (quota) return fieldRefusal("file", quota);
  }

  const consumed: ConsumedUpload[] = [];
  const storage = getStorage();
  try {
    for (const uploadId of uploadIds) {
      const result = await consumeUpload(actor.id, uploadId, "attachments", Date.now(), uploadContext(requestId));
      if (!result.ok) {
        for (const f of consumed) await storage.remove(f.storageKey);
        return fieldRefusal("file", result.message);
      }
      consumed.push(result.file);
    }
    return await db.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { requestId, parentId: parent?.id ?? null, authorId: actor.id, body: body.data, isInternal: input.internal },
      });
      for (const file of consumed) {
        const attachment = await tx.attachment.create({
          data: { ownerType: "COMMENT", requestId, commentId: comment.id, title: file.fileName, uploadedById: actor.id },
        });
        const version = await tx.attachmentVersion.create({ data: { attachmentId: attachment.id, versionNo: 1, ...file, uploadedById: actor.id } });
        await tx.attachment.update({ where: { id: attachment.id }, data: { currentVersionId: version.id } });
      }
      await audit(
        {
          actorId: actor.id,
          action: input.internal ? "request.internal_note_added" : "request.comment_added",
          entityType: "Request",
          entityId: requestId,
          after: {
            ...requestRef(request),
            commentId: comment.id,
            parentId: parent?.id ?? null,
            isInternal: input.internal,
            length: body.data.length,
            files: consumed.map((f) => ({ fileName: f.fileName, size: f.size, sha256: f.sha256 })),
          },
        },
        tx,
      );

      const text = `${request.referenceNo ?? ""} — ${request.title}`;
      const staff = request.assignedSupervisorId ? [request.assignedSupervisorId] : await activeManagerIds(tx);
      if (input.internal) {
        // Never to officers: only staff can be recipients here.
        const recipients = [request.assignedSupervisorId, parent && parent.authorId].filter(Boolean) as string[];
        const staffOnly = await tx.user.findMany({ where: { id: { in: recipients }, role: { in: ["SUPERVISOR", "UNIT_MANAGER"] } }, select: { id: true } });
        await notify(tx, staffOnly.map((u) => u.id), { type: parent ? "comment.reply" : "comment.created", title: "ملاحظة داخلية جديدة", body: text, requestId }, actor.id);
      } else if (actor.role === "ASSOCIATION_OFFICER") {
        await notify(tx, [...staff, parent?.authorId], { type: parent ? "comment.reply" : "comment.created", title: "تعليق جديد من الجمعية", body: text, requestId }, actor.id);
      } else {
        const officers = await associationRecipients(tx, request.associationId);
        await notify(tx, [...officers, request.assignedSupervisorId, parent?.authorId], { type: parent ? "comment.reply" : "comment.created", title: "تعليق جديد على الطلب", body: text, requestId }, actor.id);
      }
      return { ok: true, id: comment.id };
    });
  } catch (error) {
    for (const f of consumed) await storage.remove(f.storageKey);
    throw error;
  }
}

/** Whether the actor may write comments / internal notes on submitted requests at all. */
export function commentCapabilities(actor: Actor) {
  return { canComment: can(actor.role, "comments.write"), canWriteInternal: can(actor.role, "comments.writeInternal") };
}
