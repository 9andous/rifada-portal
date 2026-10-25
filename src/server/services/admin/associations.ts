import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { enumParam, pageWindow, parseListParams, type Page, type SearchParams } from "@/lib/list-params";
import type { AssociationFormInput, OfficerFormInput } from "@/lib/validation/admin";
import { generateTemporaryPassword } from "@/server/auth/temp-password";
import { createUserWithPassword, revokeSessions } from "@/server/auth/users";
import { scopeFor } from "@/server/authz/permissions";
import { ForbiddenError, scopeAssociations, type Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { PAGE_SIZE, assertCan, containsAny, fieldRefusal, lockAdminWrites, refuse, type Result } from "./common";
import { checkAssociationFree, userSnapshot } from "./users";

type AssociationSnapshotSource = {
  name: string;
  licenseNumber: string | null;
  city: string | null;
  region: string | null;
  classification: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
};

export function associationSnapshot(a: AssociationSnapshotSource) {
  return {
    name: a.name,
    licenseNumber: a.licenseNumber,
    city: a.city,
    region: a.region,
    classification: a.classification,
    contactName: a.contactName,
    contactEmail: a.contactEmail,
    contactPhone: a.contactPhone,
    isActive: a.isActive,
  };
}

/**
 * The registry views (list and detail) are for roles that see every association: the super admin
 * and, read-only, the unit manager. Supervisors' and officers' own association views are later phases.
 */
function assertRegistryReader(actor: Actor) {
  if (scopeFor(actor.role, "associations.read") !== "all") throw new ForbiddenError("associations.read");
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const ASSOCIATION_SORTS = ["name", "city", "region", "createdAt"] as const;
export const ASSOCIATION_STATUSES = ["active", "inactive"] as const;
export const OFFICER_FILTERS = ["with", "without"] as const;

export function parseAssociationListParams(params: SearchParams) {
  return {
    ...parseListParams(params, ASSOCIATION_SORTS, { sort: "name", dir: "asc" }),
    status: enumParam(params, "status", ASSOCIATION_STATUSES),
    officer: enumParam(params, "officer", OFFICER_FILTERS),
    region: typeof params.region === "string" && params.region ? params.region.slice(0, 80) : undefined,
  };
}

export type AssociationListParams = ReturnType<typeof parseAssociationListParams>;

export type AssociationRow = {
  id: string;
  name: string;
  licenseNumber: string | null;
  city: string | null;
  region: string | null;
  classification: string | null;
  contactName: string | null;
  isActive: boolean;
  createdAt: Date;
  officer: { id: string; username: string | null; isActive: boolean } | null;
};

export async function listAssociations(actor: Actor, params: AssociationListParams): Promise<Page<AssociationRow>> {
  assertRegistryReader(actor);
  const and: Prisma.AssociationWhereInput[] = [scopeAssociations(actor)];
  if (params.q) and.push({ OR: containsAny(params.q, ["name", "licenseNumber", "city", "region", "contactName", "contactEmail"] as const) });
  if (params.status) and.push({ isActive: params.status === "active" });
  if (params.officer) and.push({ officer: params.officer === "with" ? { isNot: null } : { is: null } });
  if (params.region) and.push({ region: params.region });
  const where: Prisma.AssociationWhereInput = { AND: and };

  const total = await db.association.count({ where });
  const win = pageWindow(total, params.page, PAGE_SIZE);
  const order = params.sort === "name" || params.sort === "createdAt" ? params.dir : { sort: params.dir, nulls: "last" as const };
  const rows = await db.association.findMany({
    where,
    orderBy: [{ [params.sort]: order }, { id: "asc" }],
    skip: win.skip,
    take: win.take,
    select: {
      id: true,
      name: true,
      licenseNumber: true,
      city: true,
      region: true,
      classification: true,
      contactName: true,
      isActive: true,
      createdAt: true,
      officer: { select: { id: true, username: true, isActive: true } },
    },
  });
  return { items: rows, total, page: win.page, pageSize: PAGE_SIZE, pageCount: win.pageCount };
}

export async function associationFigures(actor: Actor) {
  assertRegistryReader(actor);
  const scope = scopeAssociations(actor);
  const [total, active, withOfficer] = await Promise.all([
    db.association.count({ where: scope }),
    db.association.count({ where: { AND: [scope, { isActive: true }] } }),
    db.association.count({ where: { AND: [scope, { officer: { isNot: null } }] } }),
  ]);
  return { total, active, inactive: total - active, withOfficer, withoutOfficer: total - withOfficer };
}

/** Distinct regions in use, for the region filter. */
export async function associationRegions(actor: Actor): Promise<string[]> {
  assertRegistryReader(actor);
  const rows = await db.association.findMany({
    where: { AND: [scopeAssociations(actor), { region: { not: null } }] },
    distinct: ["region"],
    orderBy: { region: "asc" },
    select: { region: true },
  });
  return rows.flatMap((r) => (r.region ? [r.region] : []));
}

export async function getAssociationDetail(actor: Actor, id: string) {
  assertRegistryReader(actor);
  const association = await db.association.findFirst({
    where: { AND: [scopeAssociations(actor), { id }] },
    include: {
      officer: { select: { id: true, username: true, name: true, isActive: true, lastLoginAt: true, mustChangePassword: true } },
    },
  });
  if (!association) return null;
  // Staff counts leave drafts out (D-026): drafts belong to the association until submitted.
  const submittedRequests = await db.request.count({ where: { associationId: id, submittedAt: { not: null } } });
  return { ...association, submittedRequests };
}

export type AssociationDetail = NonNullable<Awaited<ReturnType<typeof getAssociationDetail>>>;

// ---------------------------------------------------------------------------
// Writes (super admin only)
// ---------------------------------------------------------------------------

const MSG = {
  notFound: "الجمعية غير موجودة.",
  licenseTaken: "رقم الترخيص مسجل لجمعية أخرى.",
  usernameTaken: "اسم المستخدم مستخدم لحساب آخر.",
  emailTaken: "البريد الإلكتروني مسجل لحساب آخر.",
} as const;

async function checkLicense(tx: Prisma.TransactionClient, licenseNumber: string | null, exceptId?: string): Promise<Result> {
  if (!licenseNumber) return { ok: true };
  const other = await tx.association.findFirst({
    where: { licenseNumber, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return other ? fieldRefusal("licenseNumber", MSG.licenseTaken) : { ok: true };
}

export async function createAssociation(
  actor: Actor,
  input: AssociationFormInput,
  officer: OfficerFormInput | null,
): Promise<Result<{ associationId: string; officer: { username: string; password: string } | null }>> {
  assertCan(actor, "associations.manage");
  if (officer) assertCan(actor, "users.manage");
  const password = officer ? generateTemporaryPassword() : null;

  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const license = await checkLicense(tx, input.licenseNumber);
    if (!license.ok) return license;
    if (officer) {
      const free = await checkOfficerAccount(tx, officer);
      if (!free.ok) return free;
    }

    const association = await tx.association.create({ data: { ...input } });
    await audit(
      { actorId: actor.id, action: "association.created", entityType: "Association", entityId: association.id, after: associationSnapshot(association) },
      tx,
    );

    if (!officer || !password) return { ok: true, associationId: association.id, officer: null };

    const created = await insertOfficer(tx, actor, association.id, officer, password);
    return { ok: true, associationId: association.id, officer: { username: created.username, password } };
  });
}

/** Username and email of a new officer account must be free. */
async function checkOfficerAccount(tx: Prisma.TransactionClient, officer: OfficerFormInput): Promise<Result> {
  if (await tx.user.findUnique({ where: { username: officer.username }, select: { id: true } })) {
    return fieldRefusal("officer.username", MSG.usernameTaken);
  }
  if (officer.email && (await tx.user.findUnique({ where: { email: officer.email }, select: { id: true } }))) {
    return fieldRefusal("officer.email", MSG.emailTaken);
  }
  return { ok: true };
}

/** Creates the officer account of an association (one-time password, must change it) and audits it. */
async function insertOfficer(tx: Prisma.TransactionClient, actor: Actor, associationId: string, officer: OfficerFormInput, password: string) {
  const user = await createUserWithPassword(tx, {
    ...officer,
    role: "ASSOCIATION_OFFICER",
    associationId,
    password,
    mustChangePassword: true,
  });
  await audit({ actorId: actor.id, action: "user.created", entityType: "User", entityId: user.id, after: userSnapshot(user) }, tx);
  return { userId: user.id, username: user.username ?? officer.username };
}

/**
 * Creates the officer account of an existing association that has none (the «إنشاء حساب مسؤول»
 * step on the association page). The same rules as everywhere: one active association, one officer.
 */
export async function createAssociationOfficer(
  actor: Actor,
  associationId: string,
  officer: OfficerFormInput,
): Promise<Result<{ userId: string; username: string; password: string }>> {
  assertCan(actor, "associations.manage");
  assertCan(actor, "users.manage");
  const password = generateTemporaryPassword();

  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const association = await checkAssociationFree(tx, associationId);
    if (!association.ok) return { ok: false, message: Object.values(association.errors ?? {})[0] ?? association.message };
    const free = await checkOfficerAccount(tx, officer);
    if (!free.ok) return free;
    const created = await insertOfficer(tx, actor, associationId, officer, password);
    return { ok: true, ...created, password };
  });
}

export async function updateAssociation(actor: Actor, id: string, input: AssociationFormInput): Promise<Result> {
  assertCan(actor, "associations.manage");

  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const current = await tx.association.findUnique({ where: { id } });
    if (!current) return refuse(MSG.notFound);
    const license = await checkLicense(tx, input.licenseNumber, id);
    if (!license.ok) return license;

    const updated = await tx.association.update({ where: { id }, data: { ...input } });
    const before = associationSnapshot(current);
    const after = associationSnapshot(updated);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await audit({ actorId: actor.id, action: "association.updated", entityType: "Association", entityId: id, before, after }, tx);
    }
    return { ok: true };
  });
}

/**
 * Deactivating an association also deactivates its officer and ends their sessions (D-035).
 * Reactivating the association leaves the officer inactive; the admin reactivates them separately.
 */
export async function setAssociationActive(
  actor: Actor,
  id: string,
  active: boolean,
): Promise<Result<{ officerDeactivated: boolean }>> {
  assertCan(actor, "associations.manage");

  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const current = await tx.association.findUnique({ where: { id }, include: { officer: true } });
    if (!current) return refuse(MSG.notFound);
    if (current.isActive === active) return { ok: true, officerDeactivated: false };

    await tx.association.update({ where: { id }, data: { isActive: active } });
    await audit(
      {
        actorId: actor.id,
        action: active ? "association.reactivated" : "association.deactivated",
        entityType: "Association",
        entityId: id,
        before: { isActive: current.isActive },
        after: { isActive: active },
      },
      tx,
    );

    let officerDeactivated = false;
    if (!active && current.officer?.isActive) {
      await tx.user.update({ where: { id: current.officer.id }, data: { isActive: false } });
      const revokedSessions = await revokeSessions(tx, current.officer.id);
      await audit(
        {
          actorId: actor.id,
          action: "user.deactivated",
          entityType: "User",
          entityId: current.officer.id,
          before: { isActive: true },
          after: { isActive: false, revokedSessions, reason: "association.deactivated" },
        },
        tx,
      );
      officerDeactivated = true;
    }
    return { ok: true, officerDeactivated };
  });
}
