import "server-only";
import { randomInt } from "node:crypto";
import type { Prisma, RegistrationStatus } from "@/generated/prisma/client";
import { pageWindow, type Page } from "@/lib/list-params";
import type { RegistrationInput } from "@/lib/validation/registration";
import { hashPassword } from "@/server/auth/password";
import { createUserWithPasswordHash } from "@/server/auth/users";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { associationSnapshot } from "@/server/services/admin/associations";
import { assertCan, fieldRefusal, lockAdminWrites, refuse, type Result } from "@/server/services/admin/common";
import { userSnapshot } from "@/server/services/admin/users";
import { audit } from "@/server/services/audit";

// Association self-registration (D-094). Anyone may submit an application; only the super admin
// reviews it. Nothing is created in the association registry or the user table before approval.

const MSG = {
  licenseRegistered: "الجمعية برقم الترخيص هذا مسجلة في المنصة. تواصلوا مع إدارة المنصة لاستعادة الحساب.",
  licensePending: "يوجد طلب تسجيل قيد المراجعة لهذا الترخيص. تابعوا حالته برقم الطلب.",
  usernameTaken: "اسم المستخدم محجوز. اختاروا اسمًا آخر.",
  emailTaken: "البريد الإلكتروني مسجل لحساب آخر.",
  nationalIdTaken: "رقم الهوية مرتبط بحساب آخر في المنصة.",
  notFound: "لم يُعثر على طلب التسجيل.",
  notPending: "اتُّخذ قرار في هذا الطلب من قبل.",
  noteRequired: "اكتبوا سبب الرفض؛ يظهر لمقدم الطلب.",
} as const;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Random, non-sequential reference so applications cannot be enumerated. */
function newReference(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return `JM-${out}`;
}

/** Explicit field list for audit entries: no password hash, no national ID. */
function registrationSnapshot(r: {
  referenceNo: string;
  status: RegistrationStatus;
  name: string;
  licenseNumber: string;
  classification: string;
  region: string;
  city: string;
  programNumbers: number[];
  officerName: string;
  officerUsername: string;
}) {
  return {
    referenceNo: r.referenceNo,
    status: r.status,
    name: r.name,
    licenseNumber: r.licenseNumber,
    classification: r.classification,
    region: r.region,
    city: r.city,
    programNumbers: r.programNumbers,
    officerName: r.officerName,
    officerUsername: r.officerUsername,
  };
}

type Tx = Prisma.TransactionClient;

/** The license, username, email and national ID must not belong to an association, account or open application. */
async function checkFree(
  tx: Tx,
  v: { licenseNumber: string; username: string; email: string | null; nationalId: string | null },
  exceptRegistrationId?: string,
): Promise<Result> {
  const notSelf = exceptRegistrationId ? { id: { not: exceptRegistrationId } } : {};
  if (await tx.association.findFirst({ where: { licenseNumber: v.licenseNumber }, select: { id: true } })) {
    return fieldRefusal("licenseNumber", MSG.licenseRegistered);
  }
  if (await tx.associationRegistration.findFirst({ where: { licenseNumber: v.licenseNumber, status: "PENDING", ...notSelf }, select: { id: true } })) {
    return fieldRefusal("licenseNumber", MSG.licensePending);
  }
  const usernameUsed =
    (await tx.user.findUnique({ where: { username: v.username }, select: { id: true } })) ??
    (await tx.associationRegistration.findFirst({ where: { officerUsername: v.username, status: "PENDING", ...notSelf }, select: { id: true } }));
  if (usernameUsed) return fieldRefusal("username", MSG.usernameTaken);
  if (v.email && (await tx.user.findUnique({ where: { email: v.email }, select: { id: true } }))) return fieldRefusal("officerEmail", MSG.emailTaken);
  if (v.nationalId && (await tx.user.findUnique({ where: { nationalId: v.nationalId }, select: { id: true } }))) {
    return fieldRefusal("officerNationalId", MSG.nationalIdTaken);
  }
  return { ok: true };
}

/** Public: stores a new application. The password is hashed here and never stored in clear. */
export async function submitRegistration(input: RegistrationInput, now: Date = new Date()): Promise<Result<{ referenceNo: string }>> {
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const programs = await tx.program.findMany({ where: { number: { in: input.programNumbers }, archivedAt: null, isActive: true }, select: { number: true } });
    if (programs.length !== input.programNumbers.length) return fieldRefusal("programNumbers", "اختاروا من برامج الرئاسة المتاحة.");
    const free = await checkFree(tx, { licenseNumber: input.licenseNumber, username: input.username, email: input.officerEmail, nationalId: input.officerNationalId });
    if (!free.ok) return free;

    let referenceNo = newReference();
    while (await tx.associationRegistration.findUnique({ where: { referenceNo }, select: { id: true } })) referenceNo = newReference();

    const created = await tx.associationRegistration.create({
      data: {
        referenceNo,
        name: input.name,
        licenseNumber: input.licenseNumber,
        classification: input.classification,
        region: input.region,
        city: input.city,
        foundedYear: input.foundedYear,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail,
        website: input.website,
        programNumbers: input.programNumbers,
        officerName: input.officerName,
        officerUsername: input.username,
        officerEmail: input.officerEmail,
        officerPhone: input.officerPhone,
        officerNationalId: input.officerNationalId,
        passwordHash,
        pledgeAcceptedAt: now,
      },
    });
    await audit({ actorId: null, action: "registration.submitted", entityType: "AssociationRegistration", entityId: created.id, after: registrationSnapshot(created) }, tx);
    return { ok: true, referenceNo };
  });
}

export type RegistrationLookup = {
  referenceNo: string;
  name: string;
  status: RegistrationStatus;
  submittedAt: Date;
  decidedAt: Date | null;
  /** The reason, shown only for a rejected application. */
  note: string | null;
  username: string | null;
};

/** Public: the status of an application, found only with its reference and license number together. */
export async function lookupRegistration(referenceNo: string, licenseNumber: string): Promise<RegistrationLookup | null> {
  const r = await db.associationRegistration.findUnique({ where: { referenceNo } });
  if (!r || r.licenseNumber !== licenseNumber) return null;
  return {
    referenceNo: r.referenceNo,
    name: r.name,
    status: r.status,
    submittedAt: r.createdAt,
    decidedAt: r.reviewedAt,
    note: r.status === "REJECTED" ? r.decisionNote : null,
    username: r.status === "APPROVED" ? r.officerUsername : null,
  };
}

export type RegistrationRow = {
  id: string;
  referenceNo: string;
  name: string;
  licenseNumber: string;
  region: string;
  city: string;
  classification: string;
  officerName: string;
  status: RegistrationStatus;
  createdAt: Date;
  reviewedAt: Date | null;
};

const REG_PAGE = 20;

export async function listRegistrations(actor: Actor, status: RegistrationStatus, page = 1): Promise<Page<RegistrationRow>> {
  assertCan(actor, "registrations.review");
  const where = { status };
  const total = await db.associationRegistration.count({ where });
  const win = pageWindow(total, page, REG_PAGE);
  const items = await db.associationRegistration.findMany({
    where,
    orderBy: status === "PENDING" ? { createdAt: "asc" } : { reviewedAt: "desc" },
    skip: win.skip,
    take: win.take,
    select: { id: true, referenceNo: true, name: true, licenseNumber: true, region: true, city: true, classification: true, officerName: true, status: true, createdAt: true, reviewedAt: true },
  });
  return { items, total, page: win.page, pageSize: REG_PAGE, pageCount: win.pageCount };
}

export async function registrationCounts(actor: Actor): Promise<Record<RegistrationStatus, number>> {
  assertCan(actor, "registrations.review");
  const rows = await db.associationRegistration.groupBy({ by: ["status"], _count: { _all: true } });
  const count = (s: RegistrationStatus) => rows.find((r) => r.status === s)?._count._all ?? 0;
  return { PENDING: count("PENDING"), APPROVED: count("APPROVED"), REJECTED: count("REJECTED") };
}

export async function getRegistration(actor: Actor, id: string) {
  assertCan(actor, "registrations.review");
  const r = await db.associationRegistration.findUnique({
    where: { id },
    omit: { passwordHash: true },
    include: { reviewedBy: { select: { name: true } } },
  });
  if (!r) return null;
  const programs = await db.program.findMany({ where: { number: { in: r.programNumbers } }, orderBy: { number: "asc" }, select: { number: true, name: true } });
  return { ...r, programs };
}

export type RegistrationDetail = NonNullable<Awaited<ReturnType<typeof getRegistration>>>;

/** Creates the association and its officer account from a pending application, atomically. */
export async function approveRegistration(actor: Actor, id: string, note: string, now: Date = new Date()): Promise<Result<{ associationId: string }>> {
  assertCan(actor, "registrations.review");
  assertCan(actor, "associations.manage");
  assertCan(actor, "users.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const r = await tx.associationRegistration.findUnique({ where: { id } });
    if (!r) return refuse(MSG.notFound);
    if (r.status !== "PENDING" || !r.passwordHash) return refuse(MSG.notPending);
    const free = await checkFree(tx, { licenseNumber: r.licenseNumber, username: r.officerUsername, email: r.officerEmail, nationalId: r.officerNationalId }, r.id);
    if (!free.ok) return refuse(Object.values(free.errors ?? {})[0] ?? free.message ?? MSG.notPending);

    const association = await tx.association.create({
      data: {
        name: r.name,
        licenseNumber: r.licenseNumber,
        city: r.city,
        region: r.region,
        classification: r.classification,
        contactName: r.officerName,
        contactEmail: r.contactEmail,
        contactPhone: r.contactPhone,
      },
    });
    await audit({ actorId: actor.id, action: "association.created", entityType: "Association", entityId: association.id, after: associationSnapshot(association) }, tx);

    const user = await createUserWithPasswordHash(tx, {
      username: r.officerUsername,
      name: r.officerName,
      role: "ASSOCIATION_OFFICER",
      email: r.officerEmail,
      phone: r.officerPhone,
      nationalId: r.officerNationalId,
      associationId: association.id,
      passwordHash: r.passwordHash,
      mustChangePassword: false,
    });
    await audit({ actorId: actor.id, action: "user.created", entityType: "User", entityId: user.id, after: userSnapshot(user) }, tx);

    const updated = await tx.associationRegistration.update({
      where: { id },
      data: { status: "APPROVED", associationId: association.id, reviewedById: actor.id, reviewedAt: now, decisionNote: note.trim() || null, passwordHash: null },
    });
    await audit(
      { actorId: actor.id, action: "registration.approved", entityType: "AssociationRegistration", entityId: id, before: registrationSnapshot(r), after: registrationSnapshot(updated) },
      tx,
    );
    return { ok: true, associationId: association.id };
  });
}

/** Rejects a pending application with a reason the applicant sees; the stored password hash is discarded. */
export async function rejectRegistration(actor: Actor, id: string, note: string, now: Date = new Date()): Promise<Result> {
  assertCan(actor, "registrations.review");
  if (note.trim().length < 5) return fieldRefusal("note", MSG.noteRequired);
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const r = await tx.associationRegistration.findUnique({ where: { id } });
    if (!r) return refuse(MSG.notFound);
    if (r.status !== "PENDING") return refuse(MSG.notPending);
    const updated = await tx.associationRegistration.update({
      where: { id },
      data: { status: "REJECTED", reviewedById: actor.id, reviewedAt: now, decisionNote: note.trim(), passwordHash: null },
    });
    await audit(
      { actorId: actor.id, action: "registration.rejected", entityType: "AssociationRegistration", entityId: id, before: registrationSnapshot(r), after: registrationSnapshot(updated) },
      tx,
    );
    return { ok: true };
  });
}
