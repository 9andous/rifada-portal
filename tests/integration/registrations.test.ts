import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IMAGE_MAX_MB, REGISTRATION_UPLOADER, registrationLetterContext, registrationLogoContext } from "@/lib/images";
import { completionSchema, inviteSchema, LETTER_MAX_MB } from "@/lib/validation/registration";
import { verifyPassword } from "@/server/auth/password";
import type { Role } from "@/server/authz/roles";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import {
  approveRegistration,
  cancelInvitation,
  createInvitation,
  getInvitation,
  getRegistration,
  listRegistrations,
  lookupRegistration,
  registrationCounts,
  registrationLetter,
  rejectRegistration,
  renewInvitation,
  submitCompletion,
} from "@/server/services/registrations";
import { openImage } from "@/server/services/images";
import { stageUpload } from "@/server/uploads/stage";
import { makeAssociation, makeRoleActors } from "../support/admin";
import { db, resetDatabase } from "../support/db";
import { FIXTURES } from "../support/files";

const HOUR = 60 * 60 * 1000;
let ctx: Awaited<ReturnType<typeof makeRoleActors>>;
let admin: Actor;
let seq = 0;

const storageRoot = mkdtempSync(join(tmpdir(), "rifada-registration-"));
const previousStorage = process.env.STORAGE_DIR;
beforeAll(() => {
  process.env.STORAGE_DIR = storageRoot;
});
afterAll(() => {
  process.env.STORAGE_DIR = previousStorage;
  rmSync(storageRoot, { recursive: true, force: true });
});

/** The super admin's six fields, as the form sends them. */
function rawInvite(overrides: Record<string, unknown> = {}) {
  seq += 1;
  return {
    name: `جمعية سقيا الحرم ${seq}`,
    officerName: "فهد بن سعد",
    secondOfficerName: "سعد بن فهد",
    website: "",
    contactEmail: `Info${seq}@Example.org`,
    licenseNumber: `${1000 + seq}`,
    ...overrides,
  };
}

/** The association's part, as the form sends it. */
function rawCompletion(overrides: Record<string, unknown> = {}) {
  return {
    classification: "منظمات خدمة ضيوف الرحمن",
    foundedYear: "١٤٣٥",
    contactPhone: "٠٥٥٠١٢٣٤٥٦",
    website: "",
    serviceSite: "MAKKAH",
    servicePlaces: ["masaa", "mataf"],
    officerPhone: "0551234567",
    secondOfficerPhone: "",
    pledge: "on",
    ...overrides,
  };
}

async function invited(overrides: Record<string, unknown> = {}, now = new Date()) {
  const result = await createInvitation(admin, inviteSchema.parse(rawInvite(overrides)), now);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result;
}

async function stage(registrationId: string, kind: "letter" | "logo", uploaderId = REGISTRATION_UPLOADER) {
  const bytes = kind === "letter" ? FIXTURES.pdf() : FIXTURES.png();
  const staged = await stageUpload({
    uploaderId,
    sessionId: null,
    fileName: kind === "letter" ? "خطاب.pdf" : "شعار.png",
    declaredMime: kind === "letter" ? "application/pdf" : "image/png",
    contentLength: bytes.length,
    body: Readable.from([bytes]),
    context: kind === "letter" ? registrationLetterContext(registrationId) : registrationLogoContext(registrationId),
    only: kind === "letter" ? { groups: ["pdf"], maxMb: LETTER_MAX_MB } : { groups: ["image"], maxMb: IMAGE_MAX_MB },
  });
  if (!staged.ok) throw new Error(staged.message);
  return staged.uploadId;
}

async function completed(overrides: Record<string, unknown> = {}) {
  const invite = await invited();
  const letterUploadId = await stage(invite.id, "letter");
  const result = await submitCompletion(invite.token, completionSchema.parse(rawCompletion(overrides)), { letterUploadId });
  if (!result.ok) throw new Error(JSON.stringify(result));
  const row = await db.associationRegistration.findUniqueOrThrow({ where: { id: invite.id } });
  return { invite, row, referenceNo: result.referenceNo };
}

beforeEach(async () => {
  await resetDatabase();
  ctx = await makeRoleActors();
  admin = ctx.actors.SUPER_ADMIN;
});

describe("registrations: validation", () => {
  it("normalises the super admin's fields and requires both officers", () => {
    const input = inviteSchema.parse(rawInvite({ licenseNumber: "١٢٣٤" }));
    expect(input.licenseNumber).toBe("1234");
    expect(input.contactEmail).toMatch(/^info\d+@example\.org$/);
    expect(input.website).toBeNull();
    expect(inviteSchema.safeParse(rawInvite({ secondOfficerName: "" })).success).toBe(false);
    expect(inviteSchema.safeParse(rawInvite({ contactEmail: "" })).success).toBe(false);
  });

  it("takes only places of the chosen site, at least one, in the site's order", () => {
    expect(completionSchema.parse(rawCompletion()).servicePlaces).toEqual(["mataf", "masaa"]);
    expect(completionSchema.safeParse(rawCompletion({ servicePlaces: [] })).success).toBe(false);
    expect(completionSchema.safeParse(rawCompletion({ servicePlaces: ["rawdah"] })).success).toBe(false);
    expect(completionSchema.safeParse(rawCompletion({ serviceSite: "MADINAH", servicePlaces: ["rawdah"] })).success).toBe(true);
    expect(completionSchema.safeParse(rawCompletion({ serviceSite: "RIYADH" })).success).toBe(false);
    expect(completionSchema.safeParse(rawCompletion({ pledge: "" })).success).toBe(false);
    expect(completionSchema.parse(rawCompletion({ classification: "أخرى", classificationOther: "رعاية كبار السن" })).classification).toBe("رعاية كبار السن");
    expect(completionSchema.safeParse(rawCompletion({ classification: "أخرى" })).success).toBe(false);
  });
});

describe("registrations: the invitation", () => {
  it("issues a link valid for the configured hours, with an audit entry that leaves the token out", async () => {
    const now = new Date("2026-11-05T08:00:00Z");
    const invite = await invited({}, now);
    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(invite.expiresAt.getTime() - now.getTime()).toBe(48 * HOUR);
    const row = await db.associationRegistration.findUniqueOrThrow({ where: { id: invite.id } });
    expect(row).toMatchObject({ status: "INVITED", invitedById: admin.id, inviteToken: invite.token });
    expect(row.createdAt).toEqual(now);
    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "registration.invited", entityId: invite.id } });
    expect(JSON.stringify(entry.after)).not.toContain(invite.token);

    await db.setting.create({ data: { key: "registration.inviteHours", value: 72 } });
    const longer = await invited({}, now);
    expect(longer.expiresAt.getTime() - now.getTime()).toBe(72 * HOUR);
  });

  it("refuses a licence or email already registered or held by an open registration", async () => {
    await makeAssociation("جمعية قائمة", { licenseNumber: "7777" });
    const registered = await createInvitation(admin, inviteSchema.parse(rawInvite({ licenseNumber: "7777" })));
    expect(!registered.ok && registered.errors?.licenseNumber).toBeTruthy();

    await invited({ licenseNumber: "8888", contactEmail: "same@example.org" });
    const sameLicense = await createInvitation(admin, inviteSchema.parse(rawInvite({ licenseNumber: "8888" })));
    expect(!sameLicense.ok && sameLicense.errors?.licenseNumber).toBeTruthy();
    const sameEmail = await createInvitation(admin, inviteSchema.parse(rawInvite({ contactEmail: "same@example.org" })));
    expect(!sameEmail.ok && sameEmail.errors?.contactEmail).toBeTruthy();
    const userEmail = await createInvitation(admin, inviteSchema.parse(rawInvite({ contactEmail: ctx.users.manager.email })));
    expect(!userEmail.ok && userEmail.errors?.contactEmail).toBeTruthy();
  });

  it("shows the super admin's fields while open, and nothing once expired, used or unknown", async () => {
    const now = new Date();
    const invite = await invited({}, now);
    expect(await getInvitation(invite.token, now)).toMatchObject({ state: "open", officerName: "فهد بن سعد", secondOfficerName: "سعد بن فهد" });
    expect(await getInvitation(invite.token, new Date(now.getTime() + 49 * HOUR))).toEqual({ state: "expired" });
    expect(await getInvitation("x".repeat(43))).toEqual({ state: "invalid" });
    expect(await getInvitation("short")).toEqual({ state: "invalid" });
  });

  it("renews an expired link from now, and cancelling frees the licence", async () => {
    const t0 = new Date("2026-11-05T08:00:00Z");
    const invite = await invited({ licenseNumber: "4242" }, t0);
    const later = new Date(t0.getTime() + 60 * HOUR);
    expect((await getInvitation(invite.token, later)).state).toBe("expired");
    expect(await renewInvitation(admin, invite.id, 5, later)).toMatchObject({ ok: true });
    expect((await getInvitation(invite.token, new Date(later.getTime() + 4 * HOUR))).state).toBe("open");

    expect(await cancelInvitation(admin, invite.id, "")).toMatchObject({ ok: true });
    expect((await getInvitation(invite.token)).state).toBe("invalid");
    expect(await renewInvitation(admin, invite.id, 5)).toMatchObject({ ok: false });
    expect((await createInvitation(admin, inviteSchema.parse(rawInvite({ licenseNumber: "4242" })))).ok).toBe(true);
  });
});

describe("registrations: the association's part", () => {
  it("records the data and letter, keeps the admin's fields, and the link stops working", async () => {
    const { invite, row, referenceNo } = await completed();
    expect(referenceNo).toMatch(/^JM-[A-Z0-9]{8}$/);
    expect(row).toMatchObject({
      status: "PENDING",
      officerName: "فهد بن سعد",
      contactPhone: "0550123456",
      serviceSite: "MAKKAH",
      servicePlaces: ["mataf", "masaa"],
      city: "مكة المكرمة",
      region: "منطقة مكة المكرمة",
      foundedYear: 1435,
      letterFileName: "خطاب.pdf",
    });
    expect(row.letterKey).toMatch(/^attachments\//);
    expect(row.submittedAt).not.toBeNull();
    expect(await db.user.count({ where: { email: row.contactEmail! } })).toBe(0);
    expect((await getInvitation(invite.token)).state).toBe("used");

    const again = await submitCompletion(invite.token, completionSchema.parse(rawCompletion()), { letterUploadId: await stage(invite.id, "letter").catch(() => null) });
    expect(again.ok).toBe(false);
  });

  it("requires the letter, staged through this registration's own link", async () => {
    const a = await invited();
    const b = await invited();
    const input = completionSchema.parse(rawCompletion());
    expect(await submitCompletion(a.token, input, { letterUploadId: null })).toMatchObject({ ok: false, errors: { letter: expect.any(String) } });
    const forOther = await stage(b.id, "letter");
    expect(await submitCompletion(a.token, input, { letterUploadId: forOther })).toMatchObject({ ok: false, errors: { letter: expect.any(String) } });
    expect((await db.associationRegistration.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("INVITED");
  });

  it("refuses an expired link", async () => {
    const now = new Date();
    const invite = await invited({}, new Date(now.getTime() - 49 * HOUR));
    const letterUploadId = await stage(invite.id, "letter");
    expect(await submitCompletion(invite.token, completionSchema.parse(rawCompletion()), { letterUploadId }, now)).toMatchObject({ ok: false });
  });

  it("stores the logo, which moves to the association on approval", async () => {
    const invite = await invited();
    const result = await submitCompletion(invite.token, completionSchema.parse(rawCompletion()), {
      letterUploadId: await stage(invite.id, "letter"),
      logoUploadId: await stage(invite.id, "logo"),
    });
    expect(result.ok).toBe(true);
    const row = await db.associationRegistration.findUniqueOrThrow({ where: { id: invite.id } });
    expect(row.logoKey).toMatch(/^images\/[a-f0-9]{32}$/);
    expect(await openImage("registration", row.id)).toMatchObject({ mime: "image/png" });
    expect(await approveRegistration(admin, row.id, "")).toMatchObject({ ok: true });
    const association = await db.association.findFirstOrThrow({ where: { licenseNumber: row.licenseNumber } });
    expect(association.logoKey).toBe(row.logoKey);
  });
});

describe("registrations: permissions", () => {
  it("denies inviting, listing, reading and deciding to every role but the super admin", async () => {
    const { row } = await completed();
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      const actor = ctx.actors[role];
      const calls: (() => Promise<unknown>)[] = [
        () => createInvitation(actor, inviteSchema.parse(rawInvite())),
        () => renewInvitation(actor, row.id, 5),
        () => cancelInvitation(actor, row.id, ""),
        () => listRegistrations(actor, "PENDING"),
        () => registrationCounts(actor),
        () => getRegistration(actor, row.id),
        () => approveRegistration(actor, row.id, ""),
        () => rejectRegistration(actor, row.id, "بيانات غير مكتملة"),
      ];
      for (const call of calls) await expect(call(), role).rejects.toBeInstanceOf(ForbiddenError);
      expect(await registrationLetter(actor, row.id), role).toBeNull();
    }
    expect((await db.associationRegistration.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("PENDING");
    expect(await registrationLetter(admin, row.id)).toMatchObject({ fileName: "خطاب.pdf" });
  });
});

describe("registrations: decisions", () => {
  it("approval creates the association and an account signed in by email with a temporary password", async () => {
    const { row, referenceNo } = await completed();
    const result = await approveRegistration(admin, row.id, "تحقق من الترخيص");
    if (!result.ok) throw new Error(JSON.stringify(result));
    expect(result.credentials?.username).toBe(row.contactEmail);

    const reg = await db.associationRegistration.findUniqueOrThrow({ where: { id: row.id } });
    expect(reg).toMatchObject({ status: "APPROVED", reviewedById: admin.id });
    const association = await db.association.findUniqueOrThrow({ where: { id: reg.associationId! }, include: { officer: true } });
    expect(association).toMatchObject({ licenseNumber: row.licenseNumber, city: "مكة المكرمة", contactName: "فهد بن سعد" });
    expect(association.officer).toMatchObject({ email: row.contactEmail, role: "ASSOCIATION_OFFICER", mustChangePassword: true, name: "فهد بن سعد" });
    expect(association.officer?.username).toMatch(/^[a-z0-9][a-z0-9._]*$/);
    const account = await db.account.findFirstOrThrow({ where: { userId: association.officer!.id, providerId: "credential" } });
    expect(await verifyPassword({ hash: account.password!, password: result.credentials!.password })).toBe(true);

    const actions = (await db.auditLog.findMany({ where: { actorId: admin.id, action: { not: "registration.invited" } } })).map((a) => a.action).sort();
    expect(actions).toEqual(["association.created", "registration.approved", "user.created"]);
    expect(JSON.stringify(await db.auditLog.findMany())).not.toContain(result.credentials!.password);

    expect(await approveRegistration(admin, row.id, "")).toMatchObject({ ok: false });
    expect(await lookupRegistration(referenceNo, row.licenseNumber)).toMatchObject({ status: "APPROVED", signIn: row.contactEmail });
  });

  it("approval is refused when the email was taken meanwhile, leaving the application pending", async () => {
    const { row } = await completed();
    await db.user.update({ where: { id: ctx.users.manager.id }, data: { email: row.contactEmail! } });
    expect((await approveRegistration(admin, row.id, "")).ok).toBe(false);
    expect((await db.associationRegistration.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("PENDING");
    expect(await db.association.count()).toBe(1);
  });

  it("rejection needs a reason and shows it in the public lookup; a waiting link cannot be decided", async () => {
    const { row, referenceNo } = await completed();
    expect(await rejectRegistration(admin, row.id, "")).toMatchObject({ ok: false });
    expect((await rejectRegistration(admin, row.id, "رقم الترخيص لا يطابق السجل")).ok).toBe(true);
    expect(await lookupRegistration(referenceNo, row.licenseNumber)).toMatchObject({ status: "REJECTED", note: "رقم الترخيص لا يطابق السجل", signIn: null });
    expect(await lookupRegistration(referenceNo, "0000")).toBeNull();

    const waiting = await invited();
    const waitingRow = await db.associationRegistration.findUniqueOrThrow({ where: { id: waiting.id } });
    expect(await approveRegistration(admin, waiting.id, "")).toMatchObject({ ok: false });
    expect(await lookupRegistration(waitingRow.referenceNo, waitingRow.licenseNumber)).toBeNull();
  });
});
