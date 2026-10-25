import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { enumParam, pageWindow, parseListParams, type SearchParams } from "@/lib/list-params";
import type { AttachmentTypeCreateInput, AttachmentTypeUpdateInput } from "@/lib/validation/taxonomy";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { PAGE_SIZE, assertCan, containsAny, fieldRefusal, lockAdminWrites, refuse, type Result } from "./common";

// Attachment types (Phase 2b stop 1). The key is immutable after creation (D-051); archived types
// stay on the requirements that use them and are not offered for new ones. Never deleted.

export const ATTACHMENT_TYPE_SORTS = ["name", "key", "createdAt"] as const;
export const ATTACHMENT_TYPE_STATUSES = ["active", "archived"] as const;

export function parseAttachmentTypeListParams(params: SearchParams) {
  return {
    ...parseListParams(params, ATTACHMENT_TYPE_SORTS, { sort: "name", dir: "asc" }),
    status: enumParam(params, "status", ATTACHMENT_TYPE_STATUSES),
  };
}

export async function listAttachmentTypes(actor: Actor, params: ReturnType<typeof parseAttachmentTypeListParams>, editor = true) {
  assertCan(actor, editor ? "taxonomy.manage" : "taxonomy.read");
  const where: Prisma.AttachmentTypeWhereInput = {};
  if (!editor || params.status === "active") where.archivedAt = null;
  else if (params.status === "archived") where.archivedAt = { not: null };
  if (params.q) where.OR = containsAny(params.q, ["name", "key"] as const);
  const total = await db.attachmentType.count({ where });
  const win = pageWindow(total, params.page, PAGE_SIZE);
  const rows = await db.attachmentType.findMany({
    where,
    orderBy: [{ [params.sort]: params.dir }, { id: "asc" }],
    skip: win.skip,
    take: win.take,
    select: { id: true, key: true, name: true, allowedMimeGroups: true, archivedAt: true, createdAt: true, _count: { select: { requirements: true } } },
  });
  const items = rows.map(({ _count, ...t }) => ({ ...t, usage: _count.requirements }));
  return { items, total, page: win.page, pageSize: PAGE_SIZE, pageCount: win.pageCount };
}

/** Types offered for new attachment requirements. */
export async function activeAttachmentTypes(actor: Actor) {
  assertCan(actor, "taxonomy.manage");
  return db.attachmentType.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, key: true, name: true, allowedMimeGroups: true } });
}

const snapshot = (t: { key: string; name: string; allowedMimeGroups: string[] }) => ({ key: t.key, name: t.name, groups: t.allowedMimeGroups });

export async function createAttachmentType(actor: Actor, input: AttachmentTypeCreateInput): Promise<Result<{ id: string }>> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    if (await tx.attachmentType.findUnique({ where: { key: input.key }, select: { id: true } })) {
      return fieldRefusal("key", "هذا المفتاح مستخدم لنوع مرفق آخر.");
    }
    const type = await tx.attachmentType.create({ data: { key: input.key, name: input.name, allowedMimeGroups: input.groups } });
    await audit({ actorId: actor.id, action: "attachment_type.created", entityType: "AttachmentType", entityId: type.id, after: snapshot(type) }, tx);
    return { ok: true, id: type.id };
  });
}

export async function updateAttachmentType(actor: Actor, id: string, input: AttachmentTypeUpdateInput): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.attachmentType.findUnique({ where: { id } });
    if (!current) return refuse("نوع المرفق غير موجود.");
    const updated = await tx.attachmentType.update({ where: { id }, data: { name: input.name, allowedMimeGroups: input.groups } });
    if (JSON.stringify(snapshot(current)) !== JSON.stringify(snapshot(updated))) {
      await audit(
        { actorId: actor.id, action: "attachment_type.updated", entityType: "AttachmentType", entityId: id, before: snapshot(current), after: snapshot(updated) },
        tx,
      );
    }
    return { ok: true };
  });
}

export async function setAttachmentTypeArchived(actor: Actor, id: string, archived: boolean): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.attachmentType.findUnique({ where: { id } });
    if (!current) return refuse("نوع المرفق غير موجود.");
    if (Boolean(current.archivedAt) === archived) return { ok: true };
    await tx.attachmentType.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await audit(
      {
        actorId: actor.id,
        action: archived ? "attachment_type.archived" : "attachment_type.restored",
        entityType: "AttachmentType",
        entityId: id,
        before: { archived: !archived },
        after: { archived },
      },
      tx,
    );
    return { ok: true };
  });
}
