import "server-only";
import type { Readable } from "node:stream";
import type { Prisma, TemplateKind } from "@/generated/prisma/client";
import { enumParam, pageWindow, parseListParams, type SearchParams } from "@/lib/list-params";
import type { TemplateMetaInput } from "@/lib/validation/templates";
import { can } from "@/server/authz/permissions";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { getStorage } from "@/server/storage/storage";
import { consumeUpload, type ConsumedUpload } from "@/server/uploads/stage";
import { PAGE_SIZE, assertCan, containsAny, fieldRefusal, refuse, type Result } from "./common";

// Downloadable templates (Phase 2b stop 2). The super admin creates, edits, publishes and archives
// them; replacing the file adds a version and keeps the old file (D-061). Nothing is deleted.
// Everyone signed in reads published, non-archived templates.

type Tx = Prisma.TransactionClient;

export type TemplateState = "published" | "unpublished" | "archived";
export const TEMPLATE_STATES = ["published", "unpublished", "archived"] as const;
export const TEMPLATE_SORTS = ["title", "updatedAt"] as const;

export function templateState(t: { isPublished: boolean; archivedAt: Date | null }): TemplateState {
  return t.archivedAt ? "archived" : t.isPublished ? "published" : "unpublished";
}

/** What every signed-in user may see. */
export const visibleTemplateWhere = { isPublished: true, archivedAt: null } satisfies Prisma.TemplateWhereInput;

export function parseTemplateListParams(params: SearchParams) {
  return {
    ...parseListParams(params, TEMPLATE_SORTS, { sort: "updatedAt", dir: "desc" }),
    state: enumParam(params, "state", TEMPLATE_STATES),
    program: typeof params.program === "string" && params.program ? params.program : undefined,
  };
}

const listSelect = {
  id: true,
  kind: true,
  title: true,
  description: true,
  fileName: true,
  mime: true,
  size: true,
  isPublished: true,
  archivedAt: true,
  updatedAt: true,
  program: { select: { number: true, name: true } },
  initiative: { select: { number: true, name: true } },
  attachmentType: { select: { name: true } },
  _count: { select: { files: true } },
} satisfies Prisma.TemplateSelect;

/** Admin view (`content.manage`, every state) or reader view (`templates.read`, published only). */
export async function listTemplates(actor: Actor, params: ReturnType<typeof parseTemplateListParams>, view: "admin" | "reader") {
  assertCan(actor, view === "admin" ? "content.manage" : "templates.read");
  const and: Prisma.TemplateWhereInput[] = [];
  if (view === "reader") and.push(visibleTemplateWhere);
  else if (params.state === "archived") and.push({ archivedAt: { not: null } });
  else if (params.state) and.push({ archivedAt: null, isPublished: params.state === "published" });
  if (params.q) and.push({ OR: containsAny(params.q, ["title", "description", "fileName"] as const) });
  if (params.program) and.push({ programId: params.program });
  const where: Prisma.TemplateWhereInput = { AND: and };

  const total = await db.template.count({ where });
  const win = pageWindow(total, params.page, PAGE_SIZE);
  const rows = await db.template.findMany({ where, orderBy: [{ [params.sort]: params.dir }, { id: "asc" }], skip: win.skip, take: win.take, select: listSelect });
  const items = rows.map(({ _count, ...t }) => ({ ...t, state: templateState(t), versions: _count.files }));
  return { items, total, page: win.page, pageSize: PAGE_SIZE, pageCount: win.pageCount };
}

/**
 * Published templates for the association's «النماذج» page (D-102): every match at once (the list
 * is short), by programme («general» for templates meant for every programme) and words.
 */
export async function readerTemplates(actor: Actor, filter: { kind?: TemplateKind; program?: string; q?: string }) {
  assertCan(actor, "templates.read");
  const and: Prisma.TemplateWhereInput[] = [visibleTemplateWhere];
  if (filter.kind) and.push({ kind: filter.kind });
  if (filter.program === "general") and.push({ programId: null });
  else if (filter.program) and.push({ programId: filter.program });
  if (filter.q) and.push({ OR: containsAny(filter.q, ["title", "description", "fileName"] as const) });
  return db.template.findMany({
    where: { AND: and },
    orderBy: [{ title: "asc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true,
      kind: true,
      title: true,
      description: true,
      fileName: true,
      size: true,
      updatedAt: true,
      program: { select: { id: true, number: true, name: true } },
      initiative: { select: { number: true, name: true } },
      attachmentType: { select: { name: true } },
    },
  });
}

export type ReaderTemplate = Awaited<ReturnType<typeof readerTemplates>>[number];

/**
 * The choices of that page: guides and forms with their counts, and the programmes that have
 * published templates of the chosen kind, with theirs.
 */
export async function readerTemplateFilters(actor: Actor, kind?: TemplateKind) {
  assertCan(actor, "templates.read");
  const [kinds, grouped] = await Promise.all([
    db.template.groupBy({ by: ["kind"], where: visibleTemplateWhere, _count: { _all: true } }),
    db.template.groupBy({ by: ["programId"], where: { ...visibleTemplateWhere, ...(kind ? { kind } : {}) }, _count: { _all: true } }),
  ]);
  const kindCount = (k: TemplateKind) => kinds.find((g) => g.kind === k)?._count._all ?? 0;
  const ids = grouped.map((g) => g.programId).filter((id): id is string => id !== null);
  const programs = ids.length
    ? await db.program.findMany({ where: { id: { in: ids } }, orderBy: [{ sortOrder: "asc" }, { number: "asc" }], select: { id: true, number: true, name: true } })
    : [];
  const count = (id: string | null) => grouped.find((g) => g.programId === id)?._count._all ?? 0;
  return {
    all: kinds.reduce((n, g) => n + g._count._all, 0),
    guides: kindCount("GUIDE"),
    forms: kindCount("FORM"),
    total: grouped.reduce((n, g) => n + g._count._all, 0),
    general: count(null),
    programs: programs.map((p) => ({ ...p, count: count(p.id) })),
  };
}

export async function templateFigures(actor: Actor) {
  assertCan(actor, "content.manage");
  const [published, unpublished, archived] = await Promise.all([
    db.template.count({ where: { isPublished: true, archivedAt: null } }),
    db.template.count({ where: { isPublished: false, archivedAt: null } }),
    db.template.count({ where: { archivedAt: { not: null } } }),
  ]);
  return { published, unpublished, archived };
}

/** Programs, initiatives and attachment types offered in the template form (not archived). */
export async function templateFormOptions(actor: Actor) {
  assertCan(actor, "content.manage");
  const [programs, attachmentTypes] = await Promise.all([
    db.program.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
      select: { id: true, number: true, name: true, initiatives: { where: { archivedAt: null }, orderBy: { number: "asc" }, select: { id: true, number: true, name: true } } },
    }),
    db.attachmentType.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { programs, attachmentTypes };
}

export async function getTemplateDetail(actor: Actor, id: string) {
  assertCan(actor, "content.manage");
  const template = await db.template.findUnique({
    where: { id },
    include: {
      program: { select: { id: true, number: true, name: true } },
      initiative: { select: { id: true, number: true, name: true } },
      attachmentType: { select: { id: true, name: true } },
      files: {
        orderBy: { versionNo: "desc" },
        select: { id: true, versionNo: true, fileName: true, mime: true, size: true, sha256: true, createdAt: true, uploadedBy: { select: { name: true } } },
      },
    },
  });
  return template ? { ...template, state: templateState(template) } : null;
}

export type TemplateDetail = NonNullable<Awaited<ReturnType<typeof getTemplateDetail>>>;

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const MSG = {
  notFound: "النموذج غير موجود.",
  programUnavailable: "البرنامج المختار غير موجود أو مؤرشف.",
  initiativeUnavailable: "المبادرة المختارة غير موجودة أو مؤرشفة.",
  initiativeOutsideProgram: "المبادرة المختارة لا تتبع البرنامج المختار.",
  typeUnavailable: "نوع المرفق المختار غير موجود أو مؤرشف.",
  sameFile: "الملف الجديد مطابق تمامًا للإصدار الحالي، فلم يُنشأ إصدار جديد. اختر ملفًا مختلفًا.",
} as const;

/**
 * Checks the optional program, initiative and attachment type. An initiative without a program
 * takes its own program (D-065); with a program, it must belong to it.
 */
async function resolveLinks(tx: Tx, meta: TemplateMetaInput): Promise<Result<{ data: Pick<TemplateMetaInput, "programId" | "initiativeId" | "attachmentTypeId"> }>> {
  let programId = meta.programId;
  if (meta.initiativeId) {
    const initiative = await tx.initiative.findFirst({ where: { id: meta.initiativeId, archivedAt: null }, select: { programId: true } });
    if (!initiative) return fieldRefusal("initiativeId", MSG.initiativeUnavailable);
    if (programId && programId !== initiative.programId) return fieldRefusal("initiativeId", MSG.initiativeOutsideProgram);
    programId = initiative.programId;
  }
  if (programId && !(await tx.program.findFirst({ where: { id: programId, archivedAt: null }, select: { id: true } }))) {
    return fieldRefusal("programId", MSG.programUnavailable);
  }
  if (meta.attachmentTypeId && !(await tx.attachmentType.findFirst({ where: { id: meta.attachmentTypeId, archivedAt: null }, select: { id: true } }))) {
    return fieldRefusal("attachmentTypeId", MSG.typeUnavailable);
  }
  return { ok: true, data: { programId, initiativeId: meta.initiativeId, attachmentTypeId: meta.attachmentTypeId } };
}

const fileSnapshot = (f: { fileName: string; size: number; sha256: string | null; versionNo?: number }) => ({
  fileName: f.fileName,
  size: f.size,
  sha256: f.sha256,
  ...(f.versionNo ? { version: f.versionNo } : {}),
});

const metaSnapshot = (t: { kind: TemplateKind; title: string; description: string | null; programId: string | null; initiativeId: string | null; attachmentTypeId: string | null; isPublished: boolean; archivedAt: Date | null }) => ({
  kind: t.kind,
  title: t.title,
  description: t.description,
  programId: t.programId,
  initiativeId: t.initiativeId,
  attachmentTypeId: t.attachmentTypeId,
  isPublished: t.isPublished,
  archived: Boolean(t.archivedAt),
});

/** Runs `write` with a consumed upload; if the database write fails, the moved file is removed again. */
async function withUpload<T extends object>(actor: Actor, uploadId: string, write: (file: ConsumedUpload) => Promise<Result<T>>): Promise<Result<T>> {
  const consumed = await consumeUpload(actor.id, uploadId, "templates");
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

export async function createTemplate(actor: Actor, meta: TemplateMetaInput, uploadId: string): Promise<Result<{ id: string }>> {
  assertCan(actor, "content.manage");
  // Check the links before taking the upload, so a refused form keeps the staged file usable.
  const links = await resolveLinks(db, meta);
  if (!links.ok) return links;
  return withUpload(actor, uploadId, (file) =>
    db.$transaction(async (tx) => {
      const checked = await resolveLinks(tx, meta);
      if (!checked.ok) return checked;
      const template = await tx.template.create({
        data: {
          kind: meta.kind,
          title: meta.title,
          description: meta.description,
          ...checked.data,
          storageKey: file.storageKey,
          fileName: file.fileName,
          mime: file.mime,
          size: file.size,
          sha256: file.sha256,
          isPublished: false,
        },
      });
      const version = await tx.templateFile.create({
        data: { templateId: template.id, versionNo: 1, ...file, uploadedById: actor.id },
      });
      await tx.template.update({ where: { id: template.id }, data: { currentFileId: version.id } });
      await audit(
        {
          actorId: actor.id,
          action: "template.created",
          entityType: "Template",
          entityId: template.id,
          after: { ...metaSnapshot(template), file: fileSnapshot({ ...file, versionNo: 1 }) },
        },
        tx,
      );
      return { ok: true, id: template.id };
    }),
  );
}

export async function updateTemplate(actor: Actor, id: string, meta: TemplateMetaInput): Promise<Result> {
  assertCan(actor, "content.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.template.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    const links = await resolveLinks(tx, meta);
    if (!links.ok) return links;
    const updated = await tx.template.update({ where: { id }, data: { kind: meta.kind, title: meta.title, description: meta.description, ...links.data } });
    const before = metaSnapshot(current);
    const after = metaSnapshot(updated);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await audit({ actorId: actor.id, action: "template.updated", entityType: "Template", entityId: id, before, after }, tx);
    }
    return { ok: true };
  });
}

export async function setTemplatePublished(actor: Actor, id: string, published: boolean): Promise<Result> {
  assertCan(actor, "content.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.template.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    if (published && current.archivedAt) return refuse("النموذج مؤرشف؛ استعده أولًا ثم انشره.");
    if (current.isPublished === published) return { ok: true };
    await tx.template.update({ where: { id }, data: { isPublished: published } });
    await audit(
      { actorId: actor.id, action: published ? "template.published" : "template.unpublished", entityType: "Template", entityId: id, before: { isPublished: !published }, after: { isPublished: published } },
      tx,
    );
    return { ok: true };
  });
}

/** Archiving also unpublishes; restoring leaves it unpublished until published again. */
export async function setTemplateArchived(actor: Actor, id: string, archived: boolean): Promise<Result> {
  assertCan(actor, "content.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.template.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    if (Boolean(current.archivedAt) === archived) return { ok: true };
    await tx.template.update({ where: { id }, data: archived ? { archivedAt: new Date(), isPublished: false } : { archivedAt: null } });
    await audit(
      {
        actorId: actor.id,
        action: archived ? "template.archived" : "template.restored",
        entityType: "Template",
        entityId: id,
        before: { archived: !archived, isPublished: current.isPublished },
        after: { archived, isPublished: archived ? false : current.isPublished },
      },
      tx,
    );
    return { ok: true };
  });
}

/** Adds a new version as the current file; the previous file and its record stay. */
export async function replaceTemplateFile(actor: Actor, id: string, uploadId: string): Promise<Result<{ version: number }>> {
  assertCan(actor, "content.manage");
  if (!(await db.template.findUnique({ where: { id }, select: { id: true } }))) return refuse(MSG.notFound);
  return withUpload(actor, uploadId, (file) =>
    db.$transaction(async (tx) => {
      const current = await tx.template.findUnique({ where: { id }, include: { currentFile: { select: { versionNo: true } } } });
      if (!current) return refuse(MSG.notFound);
      // Same bytes as the current version: no new version (withUpload removes the committed copy).
      if (current.sha256 && current.sha256 === file.sha256) return fieldRefusal("file", MSG.sameFile);
      const last = await tx.templateFile.aggregate({ where: { templateId: id }, _max: { versionNo: true } });
      const versionNo = (last._max.versionNo ?? 0) + 1;
      const version = await tx.templateFile.create({ data: { templateId: id, versionNo, ...file, uploadedById: actor.id } });
      await tx.template.update({
        where: { id },
        data: { storageKey: file.storageKey, fileName: file.fileName, mime: file.mime, size: file.size, sha256: file.sha256, currentFileId: version.id },
      });
      await audit(
        {
          actorId: actor.id,
          action: "template.file_replaced",
          entityType: "Template",
          entityId: id,
          before: { file: fileSnapshot({ ...current, versionNo: current.currentFile?.versionNo }) },
          after: { file: fileSnapshot({ ...file, versionNo }) },
        },
        tx,
      );
      return { ok: true, version: versionNo };
    }),
  );
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export type TemplateDownload = { stream: Readable; fileName: string; mime: string; size: number };

/**
 * The file to send for a download, or null (answered as 404, so nothing reveals that a hidden
 * template exists). Published, non-archived templates: any signed-in user with templates.read.
 * Unpublished or archived templates and earlier versions: the super admin only.
 */
export async function templateDownload(actor: Actor, id: string, version?: number): Promise<TemplateDownload | null> {
  const isAdmin = can(actor.role, "content.manage");
  if (!isAdmin && !can(actor.role, "templates.read")) return null;
  const template = await db.template.findUnique({ where: { id }, select: { isPublished: true, archivedAt: true, currentFileId: true } });
  if (!template) return null;
  const visible = template.isPublished && !template.archivedAt;
  if (!visible && !isAdmin) return null;
  if (version !== undefined && !isAdmin) return null;
  const file = await db.templateFile.findFirst({
    where: version !== undefined ? { templateId: id, versionNo: version } : { id: template.currentFileId ?? "" },
    select: { storageKey: true, fileName: true, mime: true, size: true },
  });
  if (!file) return null;
  const storage = getStorage();
  return { stream: storage.openRead(file.storageKey), fileName: file.fileName, mime: file.mime, size: await storage.size(file.storageKey) };
}
