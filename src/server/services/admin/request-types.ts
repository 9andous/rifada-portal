import "server-only";
import type { RequestTypeFormInput } from "@/lib/validation/taxonomy";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { assertCan, fieldRefusal, lockAdminWrites, refuse, type Result } from "./common";

// «أنواع الطلبات» (D-123): the kinds of request an association can submit. The super admin adds,
// renames, pauses and archives them; they are never deleted, since requests keep their type.

const MSG = {
  notFound: "نوع الطلب غير موجود.",
  nameTaken: "يوجد نوع طلب بهذا الاسم.",
} as const;

const snapshot = (t: { name: string; description: string | null; isActive: boolean }) => ({ name: t.name, description: t.description, isActive: t.isActive });

export async function listRequestTypes(actor: Actor) {
  assertCan(actor, "taxonomy.manage");
  const rows = await db.requestType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, isActive: true, archivedAt: true, sortOrder: true, _count: { select: { requests: true } } },
  });
  // Archived types last.
  return rows
    .map(({ _count, ...t }) => ({ ...t, requests: _count.requests }))
    .sort((x, y) => Number(Boolean(x.archivedAt)) - Number(Boolean(y.archivedAt)));
}

export type RequestTypeRow = Awaited<ReturnType<typeof listRequestTypes>>[number];

async function nameFree(name: string, exceptId?: string) {
  return !(await db.requestType.findFirst({ where: { name, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } }));
}

export async function createRequestType(actor: Actor, input: RequestTypeFormInput): Promise<Result<{ id: string }>> {
  assertCan(actor, "taxonomy.manage");
  if (!(await nameFree(input.name))) return fieldRefusal("name", MSG.nameTaken);
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const last = await tx.requestType.aggregate({ _max: { sortOrder: true } });
    const type = await tx.requestType.create({ data: { ...input, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await audit({ actorId: actor.id, action: "request_type.created", entityType: "RequestType", entityId: type.id, after: snapshot(type) }, tx);
    return { ok: true, id: type.id };
  });
}

export async function updateRequestType(actor: Actor, id: string, input: RequestTypeFormInput): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  if (!(await nameFree(input.name, id))) return fieldRefusal("name", MSG.nameTaken);
  return db.$transaction(async (tx) => {
    const current = await tx.requestType.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    const updated = await tx.requestType.update({ where: { id }, data: input });
    const before = snapshot(current);
    const after = snapshot(updated);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await audit({ actorId: actor.id, action: "request_type.updated", entityType: "RequestType", entityId: id, before, after }, tx);
    }
    return { ok: true };
  });
}

/** Paused types are not offered for new requests; drafts that have one must choose another. */
export async function setRequestTypeActive(actor: Actor, id: string, active: boolean): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.requestType.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    if (current.isActive === active) return { ok: true };
    await tx.requestType.update({ where: { id }, data: { isActive: active } });
    await audit({ actorId: actor.id, action: active ? "request_type.activated" : "request_type.paused", entityType: "RequestType", entityId: id, before: { isActive: !active }, after: { isActive: active } }, tx);
    return { ok: true };
  });
}

export async function setRequestTypeArchived(actor: Actor, id: string, archived: boolean): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.requestType.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    if (Boolean(current.archivedAt) === archived) return { ok: true };
    await tx.requestType.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await audit(
      { actorId: actor.id, action: archived ? "request_type.archived" : "request_type.restored", entityType: "RequestType", entityId: id, before: { archived: !archived }, after: { archived } },
      tx,
    );
    return { ok: true };
  });
}
