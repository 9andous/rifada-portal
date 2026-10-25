import "server-only";
import { Prisma, type RequirementKind } from "@/generated/prisma/client";
import type {
  AttachmentRequirementCreateInput,
  FieldRequirementCreateInput,
  FieldRequirementUpdateInput,
  FieldTypeValue,
} from "@/lib/validation/taxonomy";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { assertCan, fieldRefusal, lockAdminWrites, refuse, type Result } from "./common";

// Per-initiative requirements (Phase 2b stop 1): fields and attachments the association must
// provide in addition to the fixed general request fields. Keys are immutable after creation
// (D-051). Requirements are not referenced by other rows (requests keep values by key), so removing
// one is allowed and audited (D-054).

type Tx = Prisma.TransactionClient;

const requirementSelect = {
  id: true,
  kind: true,
  key: true,
  label: true,
  fieldType: true,
  options: true,
  isRequired: true,
  sortOrder: true,
  attachmentType: { select: { id: true, key: true, name: true, allowedMimeGroups: true, archivedAt: true } },
} satisfies Prisma.InitiativeRequirementSelect;

type RequirementRow = Prisma.InitiativeRequirementGetPayload<{ select: typeof requirementSelect }>;

export type RequirementView = Omit<RequirementRow, "options" | "fieldType"> & { fieldType: FieldTypeValue | null; options: string[] };

function shape(r: RequirementRow): RequirementView {
  return { ...r, fieldType: r.fieldType as FieldTypeValue | null, options: Array.isArray(r.options) ? (r.options as string[]) : [] };
}

/** Comparable snapshot for audit and the copy preview (no ids). */
export function requirementSnapshot(r: RequirementView) {
  return {
    kind: r.kind,
    key: r.key,
    label: r.label,
    fieldType: r.fieldType,
    options: r.options,
    attachmentType: r.attachmentType?.key ?? null,
    isRequired: r.isRequired,
    sortOrder: r.sortOrder,
  };
}
export type RequirementSnapshot = ReturnType<typeof requirementSnapshot>;

async function readRequirements(client: Tx | typeof db, initiativeId: string): Promise<RequirementView[]> {
  const rows = await client.initiativeRequirement.findMany({
    where: { initiativeId },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { key: "asc" }],
    select: requirementSelect,
  });
  return rows.map(shape);
}

/** Requirements of one initiative. Officers will read them on the request form (Phase 3), so taxonomy.read suffices. */
export async function listRequirements(actor: Actor, initiativeId: string, editor = true) {
  assertCan(actor, editor ? "taxonomy.manage" : "taxonomy.read");
  const all = await readRequirements(db, initiativeId);
  return { fields: all.filter((r) => r.kind === "FIELD"), attachments: all.filter((r) => r.kind === "ATTACHMENT") };
}

const MSG = {
  notFound: "المتطلب غير موجود.",
  initiativeNotFound: "المبادرة غير موجودة.",
  keyTaken: "هذا المفتاح مستخدم لمتطلب آخر في هذه المبادرة.",
  typeTaken: "نوع المرفق هذا مطلوب بالفعل في هذه المبادرة.",
  typeUnavailable: "نوع المرفق غير موجود أو مؤرشف.",
  archivedInitiative: "المبادرة مؤرشفة؛ استعدها أولًا لتعديل متطلباتها.",
} as const;

async function nextSortOrder(tx: Tx, initiativeId: string, kind: RequirementKind) {
  const last = await tx.initiativeRequirement.aggregate({ where: { initiativeId, kind }, _max: { sortOrder: true } });
  return (last._max.sortOrder ?? 0) + 1;
}

async function editableInitiative(tx: Tx, initiativeId: string): Promise<Result> {
  const initiative = await tx.initiative.findUnique({ where: { id: initiativeId }, select: { archivedAt: true } });
  if (!initiative) return refuse(MSG.initiativeNotFound);
  if (initiative.archivedAt) return refuse(MSG.archivedInitiative);
  return { ok: true };
}

async function auditRequirement(tx: Tx, actor: Actor, action: string, id: string, initiativeId: string, before?: RequirementSnapshot, after?: RequirementSnapshot) {
  await audit(
    {
      actorId: actor.id,
      action,
      entityType: "InitiativeRequirement",
      entityId: id,
      before: before ? { initiativeId, ...before } : undefined,
      after: after ? { initiativeId, ...after } : undefined,
    },
    tx,
  );
}

export async function createFieldRequirement(actor: Actor, initiativeId: string, input: FieldRequirementCreateInput): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const editable = await editableInitiative(tx, initiativeId);
    if (!editable.ok) return editable;
    if (await tx.initiativeRequirement.findUnique({ where: { initiativeId_key: { initiativeId, key: input.key } }, select: { id: true } })) {
      return fieldRefusal("key", MSG.keyTaken);
    }
    const row = await tx.initiativeRequirement.create({
      data: {
        initiativeId,
        kind: "FIELD",
        key: input.key,
        label: input.label,
        fieldType: input.fieldType,
        options: input.fieldType === "SELECT" ? input.options : undefined,
        isRequired: input.isRequired,
        sortOrder: await nextSortOrder(tx, initiativeId, "FIELD"),
      },
      select: requirementSelect,
    });
    await auditRequirement(tx, actor, "requirement.created", row.id, initiativeId, undefined, requirementSnapshot(shape(row)));
    return { ok: true };
  });
}

/** Label, type, options and required flag may change; the key never does. */
export async function updateFieldRequirement(actor: Actor, id: string, input: FieldRequirementUpdateInput): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.initiativeRequirement.findUnique({ where: { id }, select: { ...requirementSelect, initiativeId: true } });
    if (!current || current.kind !== "FIELD") return refuse(MSG.notFound);
    const editable = await editableInitiative(tx, current.initiativeId);
    if (!editable.ok) return editable;
    const updated = await tx.initiativeRequirement.update({
      where: { id },
      data: {
        label: input.label,
        fieldType: input.fieldType,
        // Options are kept only for select lists; changing the type clears them.
        options: input.fieldType === "SELECT" ? input.options : Prisma.DbNull,
        isRequired: input.isRequired,
      },
      select: requirementSelect,
    });
    const before = requirementSnapshot(shape(current));
    const after = requirementSnapshot(shape(updated));
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await auditRequirement(tx, actor, "requirement.updated", id, current.initiativeId, before, after);
    }
    return { ok: true };
  });
}

export async function createAttachmentRequirement(actor: Actor, initiativeId: string, input: AttachmentRequirementCreateInput): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const editable = await editableInitiative(tx, initiativeId);
    if (!editable.ok) return editable;
    const type = await tx.attachmentType.findUnique({ where: { id: input.attachmentTypeId } });
    if (!type || type.archivedAt) return fieldRefusal("attachmentTypeId", MSG.typeUnavailable);
    if (await tx.initiativeRequirement.findUnique({ where: { initiativeId_key: { initiativeId, key: type.key } }, select: { id: true } })) {
      return fieldRefusal("attachmentTypeId", MSG.typeTaken);
    }
    const row = await tx.initiativeRequirement.create({
      data: {
        initiativeId,
        kind: "ATTACHMENT",
        key: type.key,
        label: type.name,
        attachmentTypeId: type.id,
        isRequired: input.isRequired,
        sortOrder: await nextSortOrder(tx, initiativeId, "ATTACHMENT"),
      },
      select: requirementSelect,
    });
    await auditRequirement(tx, actor, "requirement.created", row.id, initiativeId, undefined, requirementSnapshot(shape(row)));
    return { ok: true };
  });
}

export async function updateAttachmentRequirement(actor: Actor, id: string, isRequired: boolean): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.initiativeRequirement.findUnique({ where: { id }, select: { ...requirementSelect, initiativeId: true } });
    if (!current || current.kind !== "ATTACHMENT") return refuse(MSG.notFound);
    const editable = await editableInitiative(tx, current.initiativeId);
    if (!editable.ok) return editable;
    if (current.isRequired === isRequired) return { ok: true };
    const updated = await tx.initiativeRequirement.update({ where: { id }, data: { isRequired }, select: requirementSelect });
    await auditRequirement(tx, actor, "requirement.updated", id, current.initiativeId, requirementSnapshot(shape(current)), requirementSnapshot(shape(updated)));
    return { ok: true };
  });
}

export async function removeRequirement(actor: Actor, id: string): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    const current = await tx.initiativeRequirement.findUnique({ where: { id }, select: { ...requirementSelect, initiativeId: true } });
    if (!current) return refuse(MSG.notFound);
    const editable = await editableInitiative(tx, current.initiativeId);
    if (!editable.ok) return editable;
    await tx.initiativeRequirement.delete({ where: { id } });
    await auditRequirement(tx, actor, "requirement.removed", id, current.initiativeId, requirementSnapshot(shape(current)), undefined);
    return { ok: true };
  });
}

/** Swaps sortOrder with the neighbour of the same kind. */
export async function moveRequirement(actor: Actor, id: string, direction: "up" | "down"): Promise<Result> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const current = await tx.initiativeRequirement.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    const siblings = await tx.initiativeRequirement.findMany({
      where: { initiativeId: current.initiativeId, kind: current.kind },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      select: { id: true, key: true },
    });
    const index = siblings.findIndex((s) => s.id === id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= siblings.length) return { ok: true };
    const reordered = [...siblings];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    // Renumber 1..n so ties from older data cannot block a move.
    for (const [i, s] of reordered.entries()) await tx.initiativeRequirement.update({ where: { id: s.id }, data: { sortOrder: i + 1 } });
    await audit(
      {
        actorId: actor.id,
        action: "requirement.reordered",
        entityType: "InitiativeRequirement",
        entityId: id,
        before: { initiativeId: current.initiativeId, order: siblings.map((s) => s.key) },
        after: { initiativeId: current.initiativeId, order: reordered.map((s) => s.key) },
      },
      tx,
    );
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// «نسخ المتطلبات إلى مبادرات أخرى»: replace all (D-049)
// ---------------------------------------------------------------------------

export type CopyTarget = { initiativeIds?: string[]; programId?: string };

export type CopyPreviewItem = {
  initiativeId: string;
  programNumber: number;
  number: number;
  name: string;
  removed: string[];
  overwritten: string[];
  unchanged: string[];
  added: string[];
};

async function resolveTargets(tx: Tx | typeof db, sourceId: string, target: CopyTarget) {
  const where: Prisma.InitiativeWhereInput = { archivedAt: null, id: { not: sourceId } };
  if (target.programId) where.programId = target.programId;
  else where.id = { in: (target.initiativeIds ?? []).filter((id) => id !== sourceId) };
  return tx.initiative.findMany({
    where,
    orderBy: [{ program: { number: "asc" } }, { number: "asc" }],
    select: { id: true, number: true, name: true, program: { select: { number: true } } },
  });
}

const comparable = (s: RequirementSnapshot) => JSON.stringify({ ...s, sortOrder: 0 });

function diff(source: RequirementView[], target: RequirementView[]) {
  const sourceByKey = new Map(source.map((r) => [r.key, requirementSnapshot(r)]));
  const targetByKey = new Map(target.map((r) => [r.key, requirementSnapshot(r)]));
  const removed = [...targetByKey.keys()].filter((k) => !sourceByKey.has(k));
  const added = [...sourceByKey.keys()].filter((k) => !targetByKey.has(k));
  const shared = [...sourceByKey.keys()].filter((k) => targetByKey.has(k));
  const overwritten = shared.filter((k) => comparable(sourceByKey.get(k)!) !== comparable(targetByKey.get(k)!));
  const unchanged = shared.filter((k) => !overwritten.includes(k));
  return { removed, added, overwritten, unchanged };
}

/** What a copy would do to each target, without writing anything. */
export async function previewCopy(actor: Actor, sourceId: string, target: CopyTarget): Promise<Result<{ items: CopyPreviewItem[]; sourceCount: number }>> {
  assertCan(actor, "taxonomy.manage");
  const source = await db.initiative.findUnique({ where: { id: sourceId }, select: { id: true } });
  if (!source) return refuse(MSG.initiativeNotFound);
  const sourceReqs = await readRequirements(db, sourceId);
  const targets = await resolveTargets(db, sourceId, target);
  const items: CopyPreviewItem[] = [];
  for (const t of targets) {
    const d = diff(sourceReqs, await readRequirements(db, t.id));
    items.push({ initiativeId: t.id, programNumber: t.program.number, number: t.number, name: t.name, ...d });
  }
  return { ok: true, items, sourceCount: sourceReqs.length };
}

/** Each target ends up with exactly the source's requirements. One transaction, one audit entry per target. */
export async function copyRequirements(actor: Actor, sourceId: string, target: CopyTarget): Promise<Result<{ targets: number }>> {
  assertCan(actor, "taxonomy.manage");
  return db.$transaction(
    async (tx) => {
      await lockAdminWrites(tx);
      const source = await tx.initiative.findUnique({ where: { id: sourceId }, select: { id: true } });
      if (!source) return refuse(MSG.initiativeNotFound);
      const sourceReqs = await readRequirements(tx, sourceId);
      const targets = await resolveTargets(tx, sourceId, target);
      if (targets.length === 0) return refuse("اختر مبادرة واحدة على الأقل غير المبادرة الحالية.");
      for (const t of targets) {
        const before = (await readRequirements(tx, t.id)).map(requirementSnapshot);
        await tx.initiativeRequirement.deleteMany({ where: { initiativeId: t.id } });
        if (sourceReqs.length > 0) {
          await tx.initiativeRequirement.createMany({
            data: sourceReqs.map((r) => ({
              initiativeId: t.id,
              kind: r.kind,
              key: r.key,
              label: r.label,
              fieldType: r.fieldType,
              options: r.kind === "FIELD" && r.fieldType === "SELECT" ? r.options : undefined,
              attachmentTypeId: r.attachmentType?.id ?? null,
              isRequired: r.isRequired,
              sortOrder: r.sortOrder,
            })),
          });
        }
        await audit(
          {
            actorId: actor.id,
            action: "requirements.copied",
            entityType: "Initiative",
            entityId: t.id,
            before: { requirements: before },
            after: { sourceInitiativeId: sourceId, requirements: sourceReqs.map(requirementSnapshot) },
          },
          tx,
        );
      }
      return { ok: true, targets: targets.length };
    },
    { timeout: 30_000 },
  );
}
