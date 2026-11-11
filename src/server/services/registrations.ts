import "server-only";
import type { Readable } from "node:stream";
import { randomBytes, randomInt } from "node:crypto";
import { commitRegistrationLogo, registrationLogoUsable } from "@/server/services/images";
import { NOT_USABLE, consumeUpload, peekUpload } from "@/server/uploads/stage";
import type { Prisma, RegistrationStatus } from "@/generated/prisma/client";
import { REGISTRATION_UPLOADER, registrationLetterContext } from "@/lib/images";
import { pageWindow, type Page } from "@/lib/list-params";
import { SERVICE_SITES, isServiceSite } from "@/lib/service-places";
import type { CompletionInput, InviteInput } from "@/lib/validation/registration";
import { generateTemporaryPassword } from "@/server/auth/temp-password";
import { createUserWithPassword, createUserWithPasswordHash } from "@/server/auth/users";
import { can } from "@/server/authz/permissions";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { associationSnapshot } from "@/server/services/admin/associations";
import { assertCan, fieldRefusal, lockAdminWrites, refuse, type Result } from "@/server/services/admin/common";
import { userSnapshot } from "@/server/services/admin/users";
import { audit } from "@/server/services/audit";
import { getSetting } from "@/server/settings/read";
import { getStorage, isStorageKey } from "@/server/storage/storage";

// Association registration by invitation (D-149). The super admin enters the association's name, its
// two officers, email, licence number and website; the platform issues a single-use link valid for
// `registration.inviteHours`. The association completes the rest through the link (nothing else is
// public), and the super admin approves (creating the association and its account, signed in by the
// association's email with a temporary password) or rejects. Applications from the earlier public
// self-registration (D-094) can still be decided.

const MSG = {
  licenseRegistered: "توجد جمعية مسجلة في المنصة برقم الترخيص هذا.",
  licenseOpen: "يوجد طلب تسجيل مفتوح لهذا الترخيص. افتحه من «طلبات تسجيل الجمعيات».",
  emailTaken: "البريد الإلكتروني مسجل لحساب آخر في المنصة.",
  emailOpen: "يوجد طلب تسجيل مفتوح بهذا البريد الإلكتروني.",
  usernameTaken: "اسم المستخدم المطلوب في هذا الطلب محجوز لحساب آخر.",
  nationalIdTaken: "رقم الهوية مرتبط بحساب آخر في المنصة.",
  notFound: "لم يُعثر على طلب التسجيل.",
  notPending: "اتُّخذ قرار في هذا الطلب من قبل.",
  notInvited: "لم يعد هذا الطلب بانتظار الجمعية.",
  noteRequired: "اكتب سبب الرفض؛ يظهر للجمعية في صفحة متابعة الطلب.",
  linkUnusable: "رابط التسجيل غير صالح أو انتهت صلاحيته. تواصلوا مع الوحدة الإشرافية لإصدار رابط جديد.",
  letterRequired: "أرفقوا الخطاب بصيغة PDF.",
} as const;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const HOUR = 60 * 60 * 1000;
/** A registration that still holds its licence number and email: waiting for the association or for the decision. */
const OPEN: RegistrationStatus[] = ["INVITED", "PENDING"];

/** Random, non-sequential reference so applications cannot be enumerated. */
function newReference(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return `JM-${out}`;
}

/** 256 random bits, URL-safe: the registration link's only secret. */
function newInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Explicit field list for audit entries: no token, no password hash, no national ID. */
function registrationSnapshot(r: {
  referenceNo: string;
  status: RegistrationStatus;
  name: string;
  licenseNumber: string;
  contactEmail: string | null;
  officerName: string;
  secondOfficerName: string | null;
  classification: string | null;
  serviceSite: string | null;
  servicePlaces: string[];
  inviteExpiresAt: Date | null;
}) {
  return {
    referenceNo: r.referenceNo,
    status: r.status,
    name: r.name,
    licenseNumber: r.licenseNumber,
    contactEmail: r.contactEmail,
    officerName: r.officerName,
    secondOfficerName: r.secondOfficerName,
    classification: r.classification,
    serviceSite: r.serviceSite,
    servicePlaces: r.servicePlaces,
    inviteExpiresAt: r.inviteExpiresAt?.toISOString() ?? null,
  };
}

type Tx = Prisma.TransactionClient;

/** The licence and email must not belong to an association, an account or another open registration. */
async function checkFree(tx: Tx, v: { licenseNumber: string; email: string | null }, exceptRegistrationId?: string): Promise<Result> {
  const notSelf = exceptRegistrationId ? { id: { not: exceptRegistrationId } } : {};
  if (await tx.association.findFirst({ where: { licenseNumber: v.licenseNumber }, select: { id: true } })) {
    return fieldRefusal("licenseNumber", MSG.licenseRegistered);
  }
  if (await tx.associationRegistration.findFirst({ where: { licenseNumber: v.licenseNumber, status: { in: OPEN }, ...notSelf }, select: { id: true } })) {
    return fieldRefusal("licenseNumber", MSG.licenseOpen);
  }
  if (v.email) {
    if (await tx.user.findUnique({ where: { email: v.email }, select: { id: true } })) return fieldRefusal("contactEmail", MSG.emailTaken);
    if (await tx.associationRegistration.findFirst({ where: { contactEmail: v.email, status: { in: OPEN }, ...notSelf }, select: { id: true } })) {
      return fieldRefusal("contactEmail", MSG.emailOpen);
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The super admin's invitation
// ---------------------------------------------------------------------------

/** Creates the registration with the super admin's fields and a link valid for the configured hours. */
export async function createInvitation(actor: Actor, input: InviteInput, now: Date = new Date()): Promise<Result<{ id: string; token: string; expiresAt: Date }>> {
  assertCan(actor, "registrations.review");
  assertCan(actor, "associations.manage");
  const hours = await getSetting("registration.inviteHours");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const free = await checkFree(tx, { licenseNumber: input.licenseNumber, email: input.contactEmail });
    if (!free.ok) return free;

    let referenceNo = newReference();
    while (await tx.associationRegistration.findUnique({ where: { referenceNo }, select: { id: true } })) referenceNo = newReference();
    const token = newInviteToken();
    const expiresAt = new Date(now.getTime() + hours * HOUR);

    const created = await tx.associationRegistration.create({
      data: {
        referenceNo,
        status: "INVITED",
        name: input.name,
        licenseNumber: input.licenseNumber,
        contactEmail: input.contactEmail,
        website: input.website,
        officerName: input.officerName,
        secondOfficerName: input.secondOfficerName,
        inviteToken: token,
        inviteExpiresAt: expiresAt,
        invitedById: actor.id,
        createdAt: now,
      },
    });
    await audit({ actorId: actor.id, action: "registration.invited", entityType: "AssociationRegistration", entityId: created.id, after: registrationSnapshot(created) }, tx);
    return { ok: true, id: created.id, token, expiresAt };
  });
}

/** Sets a waiting link's validity to `hours` from now (also reopens an expired link). */
export async function renewInvitation(actor: Actor, id: string, hours: number, now: Date = new Date()): Promise<Result<{ expiresAt: Date }>> {
  assertCan(actor, "registrations.review");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const r = await tx.associationRegistration.findUnique({ where: { id } });
    if (!r) return refuse(MSG.notFound);
    if (r.status !== "INVITED") return refuse(MSG.notInvited);
    const expiresAt = new Date(now.getTime() + hours * HOUR);
    const updated = await tx.associationRegistration.update({ where: { id }, data: { inviteExpiresAt: expiresAt, inviteToken: r.inviteToken ?? newInviteToken() } });
    await audit(
      { actorId: actor.id, action: "registration.invite_renewed", entityType: "AssociationRegistration", entityId: id, before: registrationSnapshot(r), after: registrationSnapshot(updated) },
      tx,
    );
    return { ok: true, expiresAt };
  });
}

/** Withdraws a registration still waiting for the association: the link stops working and the licence and email are freed. */
export async function cancelInvitation(actor: Actor, id: string, note: string, now: Date = new Date()): Promise<Result> {
  assertCan(actor, "registrations.review");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const r = await tx.associationRegistration.findUnique({ where: { id } });
    if (!r) return refuse(MSG.notFound);
    if (r.status !== "INVITED") return refuse(MSG.notInvited);
    const updated = await tx.associationRegistration.update({
      where: { id },
      data: { status: "REJECTED", inviteToken: null, reviewedById: actor.id, reviewedAt: now, decisionNote: note.trim() || "أُلغي رابط التسجيل قبل استكماله." },
    });
    await audit(
      { actorId: actor.id, action: "registration.invite_cancelled", entityType: "AssociationRegistration", entityId: id, before: registrationSnapshot(r), after: registrationSnapshot(updated) },
      tx,
    );
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// The association's link (public)
// ---------------------------------------------------------------------------

export type InvitationView =
  | {
      state: "open";
      id: string;
      name: string;
      licenseNumber: string;
      contactEmail: string;
      website: string | null;
      officerName: string;
      secondOfficerName: string | null;
      createdAt: Date;
      expiresAt: Date;
    }
  | { state: "expired" | "used" | "invalid" };

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** What the link shows: the super admin's fields while it is open, otherwise why it no longer works. */
export async function getInvitation(token: string, now: Date = new Date()): Promise<InvitationView> {
  if (!TOKEN.test(token)) return { state: "invalid" };
  const r = await db.associationRegistration.findUnique({ where: { inviteToken: token } });
  if (!r) return { state: "invalid" };
  if (r.status !== "INVITED") return { state: "used" };
  if (!r.inviteExpiresAt || r.inviteExpiresAt <= now) return { state: "expired" };
  return {
    state: "open",
    id: r.id,
    name: r.name,
    licenseNumber: r.licenseNumber,
    contactEmail: r.contactEmail ?? "",
    website: r.website,
    officerName: r.officerName,
    secondOfficerName: r.secondOfficerName,
    createdAt: r.createdAt,
    expiresAt: r.inviteExpiresAt,
  };
}

/** The registration behind an open link, or null; used by the public upload routes. */
export async function openInvitationId(token: string, now: Date = new Date()): Promise<string | null> {
  const view = await getInvitation(token, now);
  return view.state === "open" ? view.id : null;
}

/**
 * Records the association's part. The letter (required) and logo (optional) were staged through the
 * link's upload routes. The link stops working once this succeeds.
 */
export async function submitCompletion(
  token: string,
  input: CompletionInput,
  files: { letterUploadId: string | null; logoUploadId?: string | null },
  now: Date = new Date(),
): Promise<Result<{ referenceNo: string }>> {
  const view = await getInvitation(token, now);
  if (view.state !== "open") return refuse(MSG.linkUnusable);
  const id = view.id;
  const letterContext = registrationLetterContext(id);
  if (!files.letterUploadId || !(await peekUpload(REGISTRATION_UPLOADER, files.letterUploadId, letterContext, now.getTime()))) {
    return fieldRefusal("letter", files.letterUploadId ? NOT_USABLE : MSG.letterRequired);
  }
  if (files.logoUploadId && !(await registrationLogoUsable(id, files.logoUploadId))) return fieldRefusal("image", NOT_USABLE);

  // The letter moves into storage first, so a submission is never recorded without its file; it is
  // removed again if the submission is refused.
  const letter = await consumeUpload(REGISTRATION_UPLOADER, files.letterUploadId, "attachments", now.getTime(), letterContext);
  if (!letter.ok) return fieldRefusal("letter", letter.message);

  const site = SERVICE_SITES[input.serviceSite];
  const result = await db.$transaction(async (tx): Promise<Result<{ referenceNo: string }>> => {
    await lockAdminWrites(tx);
    const r = await tx.associationRegistration.findUnique({ where: { id } });
    if (!r || r.status !== "INVITED" || r.inviteToken !== token || !r.inviteExpiresAt || r.inviteExpiresAt <= now) return refuse(MSG.linkUnusable);
    const updated = await tx.associationRegistration.update({
      where: { id },
      data: {
        status: "PENDING",
        classification: input.classification,
        foundedYear: input.foundedYear,
        contactPhone: input.contactPhone,
        // The super admin's website stays; the association adds one only when none was given.
        website: r.website ?? input.website,
        serviceSite: input.serviceSite,
        servicePlaces: input.servicePlaces,
        city: site.city,
        region: site.region,
        officerPhone: input.officerPhone,
        secondOfficerPhone: input.secondOfficerPhone,
        letterKey: letter.file.storageKey,
        letterFileName: letter.file.fileName,
        letterSize: letter.file.size,
        pledgeAcceptedAt: now,
        submittedAt: now,
      },
    });
    await audit(
      { actorId: null, action: "registration.submitted", entityType: "AssociationRegistration", entityId: id, before: registrationSnapshot(r), after: registrationSnapshot(updated) },
      tx,
    );
    return { ok: true, referenceNo: updated.referenceNo };
  });
  if (!result.ok) {
    await getStorage().remove(letter.file.storageKey);
    return result;
  }
  if (files.logoUploadId) {
    const logoKey = await commitRegistrationLogo(id, files.logoUploadId);
    if (logoKey) await db.associationRegistration.update({ where: { id }, data: { logoKey } });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Following an application (public)
// ---------------------------------------------------------------------------

export type RegistrationLookup = {
  referenceNo: string;
  name: string;
  status: RegistrationStatus;
  submittedAt: Date;
  decidedAt: Date | null;
  /** The reason, shown only for a rejected application. */
  note: string | null;
  /** The sign-in name of an approved application's account. */
  signIn: string | null;
};

/** Public: the status of an application, found only with its reference and licence number together. */
export async function lookupRegistration(referenceNo: string, licenseNumber: string): Promise<RegistrationLookup | null> {
  const r = await db.associationRegistration.findUnique({ where: { referenceNo }, include: { association: { select: { officer: { select: { email: true } } } } } });
  if (!r || r.licenseNumber !== licenseNumber || r.status === "INVITED") return null;
  return {
    referenceNo: r.referenceNo,
    name: r.name,
    status: r.status,
    submittedAt: r.submittedAt ?? r.createdAt,
    decidedAt: r.reviewedAt,
    note: r.status === "REJECTED" ? r.decisionNote : null,
    signIn: r.status === "APPROVED" ? (r.officerUsername ?? r.association?.officer?.email ?? r.contactEmail) : null,
  };
}

// ---------------------------------------------------------------------------
// The super admin's lists and decision
// ---------------------------------------------------------------------------

export type RegistrationRow = {
  id: string;
  referenceNo: string;
  name: string;
  licenseNumber: string;
  contactEmail: string | null;
  serviceSite: string | null;
  classification: string | null;
  officerName: string;
  status: RegistrationStatus;
  createdAt: Date;
  submittedAt: Date | null;
  inviteExpiresAt: Date | null;
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
    orderBy: status === "INVITED" ? { createdAt: "desc" } : status === "PENDING" ? { submittedAt: "asc" } : { reviewedAt: "desc" },
    skip: win.skip,
    take: win.take,
    select: {
      id: true,
      referenceNo: true,
      name: true,
      licenseNumber: true,
      contactEmail: true,
      serviceSite: true,
      classification: true,
      officerName: true,
      status: true,
      createdAt: true,
      submittedAt: true,
      inviteExpiresAt: true,
      reviewedAt: true,
    },
  });
  return { items, total, page: win.page, pageSize: REG_PAGE, pageCount: win.pageCount };
}

export async function registrationCounts(actor: Actor): Promise<Record<RegistrationStatus, number>> {
  assertCan(actor, "registrations.review");
  const rows = await db.associationRegistration.groupBy({ by: ["status"], _count: { _all: true } });
  const count = (s: RegistrationStatus) => rows.find((r) => r.status === s)?._count._all ?? 0;
  return { INVITED: count("INVITED"), PENDING: count("PENDING"), APPROVED: count("APPROVED"), REJECTED: count("REJECTED") };
}

export async function getRegistration(actor: Actor, id: string) {
  assertCan(actor, "registrations.review");
  return db.associationRegistration.findUnique({
    where: { id },
    omit: { passwordHash: true },
    include: { reviewedBy: { select: { name: true } }, invitedBy: { select: { name: true } } },
  });
}

export type RegistrationDetail = NonNullable<Awaited<ReturnType<typeof getRegistration>>>;

/** The registration of an association, for its page; null when it was added another way. */
export async function registrationOfAssociation(actor: Actor, associationId: string) {
  if (!can(actor.role, "registrations.review")) return null;
  return db.associationRegistration.findUnique({
    where: { associationId },
    select: { id: true, referenceNo: true, secondOfficerName: true, secondOfficerPhone: true, serviceSite: true, servicePlaces: true, letterKey: true, letterFileName: true },
  });
}

/** A username for the account, from the email's local part; people sign in with the email itself. */
async function usernameFor(tx: Tx, email: string): Promise<string> {
  let base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, ".")
    .replace(/^[._]+/, "")
    .slice(0, 34);
  if (base.length < 3) base = `jm.${base}`.replace(/\.+$/, "").padEnd(3, "0");
  let candidate = base;
  for (let n = 2; await tx.user.findUnique({ where: { username: candidate }, select: { id: true } }); n++) candidate = `${base}.${n}`;
  return candidate;
}

/**
 * Creates the association and its account from a submitted application, atomically. The account
 * signs in with the association's email and a temporary password shown once to the super admin;
 * it must be changed at the first sign-in. Applications from the earlier self-registration keep
 * the username and password their applicant chose.
 */
export async function approveRegistration(actor: Actor, id: string, note: string, now: Date = new Date()): Promise<Result<{ associationId: string; credentials?: { username: string; password: string } }>> {
  assertCan(actor, "registrations.review");
  assertCan(actor, "associations.manage");
  assertCan(actor, "users.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const r = await tx.associationRegistration.findUnique({ where: { id } });
    if (!r) return refuse(MSG.notFound);
    if (r.status !== "PENDING") return refuse(MSG.notPending);
    const legacy = Boolean(r.passwordHash && r.officerUsername);
    const email = legacy ? r.officerEmail : r.contactEmail;
    const free = await checkFree(tx, { licenseNumber: r.licenseNumber, email }, r.id);
    if (!free.ok) return refuse(Object.values(free.errors ?? {})[0] ?? free.message ?? MSG.notPending);
    if (legacy && (await tx.user.findUnique({ where: { username: r.officerUsername! }, select: { id: true } }))) return refuse(MSG.usernameTaken);
    if (r.officerNationalId && (await tx.user.findUnique({ where: { nationalId: r.officerNationalId }, select: { id: true } }))) return refuse(MSG.nationalIdTaken);

    const site = isServiceSite(r.serviceSite) ? SERVICE_SITES[r.serviceSite] : null;
    const association = await tx.association.create({
      data: {
        name: r.name,
        licenseNumber: r.licenseNumber,
        city: site?.city ?? r.city,
        region: site?.region ?? r.region,
        classification: r.classification,
        contactName: r.officerName,
        contactEmail: r.contactEmail,
        contactPhone: r.contactPhone ?? r.officerPhone,
        // The logo moves to the association (the application's key is cleared below), so a later
        // change of the association's logo never leaves the application pointing at a removed file.
        logoKey: r.logoKey,
      },
    });
    await audit({ actorId: actor.id, action: "association.created", entityType: "Association", entityId: association.id, after: associationSnapshot(association) }, tx);

    let credentials: { username: string; password: string } | undefined;
    let user;
    if (legacy) {
      user = await createUserWithPasswordHash(tx, {
        username: r.officerUsername!,
        name: r.officerName,
        role: "ASSOCIATION_OFFICER",
        email: r.officerEmail,
        phone: r.officerPhone,
        nationalId: r.officerNationalId,
        associationId: association.id,
        passwordHash: r.passwordHash!,
        mustChangePassword: false,
      });
    } else {
      const password = generateTemporaryPassword();
      user = await createUserWithPassword(tx, {
        username: await usernameFor(tx, r.contactEmail!),
        name: r.officerName,
        role: "ASSOCIATION_OFFICER",
        email: r.contactEmail,
        phone: r.officerPhone,
        associationId: association.id,
        password,
        mustChangePassword: true,
      });
      credentials = { username: user.email, password };
    }
    await audit({ actorId: actor.id, action: "user.created", entityType: "User", entityId: user.id, after: userSnapshot(user) }, tx);

    const updated = await tx.associationRegistration.update({
      where: { id },
      data: { status: "APPROVED", associationId: association.id, reviewedById: actor.id, reviewedAt: now, decisionNote: note.trim() || null, passwordHash: null, logoKey: null },
    });
    await audit(
      { actorId: actor.id, action: "registration.approved", entityType: "AssociationRegistration", entityId: id, before: registrationSnapshot(r), after: registrationSnapshot(updated) },
      tx,
    );
    return { ok: true, associationId: association.id, credentials };
  });
}

/** Rejects a submitted application with a reason the association sees on the follow-up page. */
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

/** The letter of an application, for the super admin only; null for anything else. */
export async function registrationLetter(actor: Actor, id: string): Promise<{ stream: Readable; fileName: string; size: number } | null> {
  if (!can(actor.role, "registrations.review")) return null;
  const r = await db.associationRegistration.findUnique({ where: { id }, select: { letterKey: true, letterFileName: true } });
  if (!r?.letterKey || !isStorageKey(r.letterKey) || !r.letterKey.startsWith("attachments/")) return null;
  const storage = getStorage();
  try {
    return { stream: storage.openRead(r.letterKey), fileName: r.letterFileName ?? "letter.pdf", size: await storage.size(r.letterKey) };
  } catch {
    return null;
  }
}
