import { beforeEach, describe, expect, it } from "vitest";
import { registrationSchema } from "@/lib/validation/registration";
import { verifyPassword } from "@/server/auth/password";
import type { Role } from "@/server/authz/roles";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import {
  approveRegistration,
  checkRegistrationAvailability,
  getRegistration,
  listRegistrations,
  lookupRegistration,
  registrationCounts,
  rejectRegistration,
  submitRegistration,
} from "@/server/services/registrations";
import { makeAssociation, makeRoleActors } from "../support/admin";
import { db, resetDatabase } from "../support/db";

const PASSWORD = "Jamiya-2026-pass";
let ctx: Awaited<ReturnType<typeof makeRoleActors>>;
let admin: Actor;
let seq = 0;

/** A valid application as the public form sends it, parsed by the real schema. */
function application(overrides: Record<string, unknown> = {}) {
  seq += 1;
  return registrationSchema.parse({
    name: `جمعية سقيا الحرم ${seq}`,
    licenseNumber: `${1000 + seq}`,
    classification: "منظمات خدمة ضيوف الرحمن",
    region: "منطقة مكة المكرمة",
    city: "مكة المكرمة",
    foundedYear: "١٤٣٥",
    contactPhone: "٠٥٥٠١٢٣٤٥٦",
    contactEmail: "",
    website: "",
    programNumbers: ["1", "3"],
    officerName: "فهد بن سعد",
    officerNationalId: "",
    officerPhone: "0551234567",
    officerEmail: `officer${seq}@example.org`,
    username: `saqya.${seq}`,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    pledge: "on",
    ...overrides,
  });
}

async function submitted(overrides: Record<string, unknown> = {}) {
  const input = application(overrides);
  const result = await submitRegistration(input);
  if (!result.ok) throw new Error(JSON.stringify(result));
  const row = await db.associationRegistration.findUniqueOrThrow({ where: { referenceNo: result.referenceNo } });
  return { input, row, referenceNo: result.referenceNo };
}

beforeEach(async () => {
  await resetDatabase();
  ctx = await makeRoleActors();
  admin = ctx.actors.SUPER_ADMIN;
});

describe("registrations: validation", () => {
  it("normalises digits and requires the pledge, a programme and matching passwords", () => {
    const input = application();
    expect(input.contactPhone).toBe("0550123456");
    expect(input.foundedYear).toBe(1435);
    expect(input.programNumbers).toEqual([1, 3]);
    expect(registrationSchema.safeParse({ ...input, foundedYear: "", pledge: "" }).success).toBe(false);
    const raw = { ...input, foundedYear: "", contactPhone: "0551111111", officerPhone: "0551111111", programNumbers: [], pledge: "on" };
    expect(registrationSchema.safeParse(raw).success).toBe(false);
    expect(registrationSchema.safeParse({ ...raw, programNumbers: ["2"], confirmPassword: "other-pass-1" }).success).toBe(false);
  });
});

describe("registrations: submission", () => {
  it("stores a pending application with a hashed password and an audit entry, creating no account", async () => {
    const { row, referenceNo } = await submitted();
    expect(referenceNo).toMatch(/^JM-[A-Z0-9]{8}$/);
    expect(row.status).toBe("PENDING");
    expect(row.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword({ hash: row.passwordHash!, password: PASSWORD })).toBe(true);
    expect(await db.user.findUnique({ where: { username: row.officerUsername } })).toBeNull();
    expect(await db.association.count()).toBe(1);
    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "registration.submitted", entityId: row.id } });
    expect(entry.actorId).toBeNull();
    expect(JSON.stringify(entry.after)).not.toMatch(/hash|password/i);
  });

  it("refuses a license already registered or already under review, and a taken username", async () => {
    await makeAssociation("جمعية قائمة", { licenseNumber: "7777" });
    const registered = await submitRegistration(application({ licenseNumber: "7777" }));
    expect(registered.ok).toBe(false);
    expect(!registered.ok && registered.errors?.licenseNumber).toBeTruthy();

    const first = await submitted({ licenseNumber: "8888" });
    const pending = await submitRegistration(application({ licenseNumber: "8888" }));
    expect(!pending.ok && pending.errors?.licenseNumber).toBeTruthy();

    const sameUser = await submitRegistration(application({ username: first.input.username }));
    expect(!sameUser.ok && sameUser.errors?.username).toBeTruthy();
    const existingUser = await submitRegistration(application({ username: ctx.users.admin.username }));
    expect(!existingUser.ok && existingUser.errors?.username).toBeTruthy();
  });

  it("refuses programmes that are not available", async () => {
    await db.program.update({ where: { number: 3 }, data: { isActive: false } });
    const result = await submitRegistration(application());
    expect(!result.ok && result.errors?.programNumbers).toBeTruthy();
  });
});

describe("registrations: permissions", () => {
  it("denies listing, reading and deciding to every role but the super admin", async () => {
    const { row } = await submitted();
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      const actor = ctx.actors[role];
      const calls: (() => Promise<unknown>)[] = [
        () => listRegistrations(actor, "PENDING"),
        () => registrationCounts(actor),
        () => getRegistration(actor, row.id),
        () => approveRegistration(actor, row.id, ""),
        () => rejectRegistration(actor, row.id, "بيانات غير مكتملة"),
      ];
      for (const call of calls) await expect(call(), role).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect((await db.associationRegistration.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("PENDING");
  });

  it("never exposes the password hash to the reviewer", async () => {
    const { row } = await submitted();
    const detail = await getRegistration(admin, row.id);
    expect(detail).not.toHaveProperty("passwordHash");
    expect(detail?.programs.map((p) => p.number)).toEqual([1, 3]);
  });
});

describe("registrations: decisions", () => {
  it("approval creates the association and an officer who signs in with the chosen password", async () => {
    const { row, input, referenceNo } = await submitted();
    const result = await approveRegistration(admin, row.id, "تحقق من الترخيص");
    expect(result.ok).toBe(true);

    const reg = await db.associationRegistration.findUniqueOrThrow({ where: { id: row.id } });
    expect(reg.status).toBe("APPROVED");
    expect(reg.passwordHash).toBeNull();
    expect(reg.reviewedById).toBe(admin.id);

    const association = await db.association.findUniqueOrThrow({ where: { id: reg.associationId! }, include: { officer: true } });
    expect(association.licenseNumber).toBe(input.licenseNumber);
    expect(association.officer?.username).toBe(input.username);
    expect(association.officer?.role).toBe("ASSOCIATION_OFFICER");
    expect(association.officer?.mustChangePassword).toBe(false);
    const account = await db.account.findFirstOrThrow({ where: { userId: association.officer!.id, providerId: "credential" } });
    expect(await verifyPassword({ hash: account.password!, password: PASSWORD })).toBe(true);

    const actions = (await db.auditLog.findMany({ where: { actorId: admin.id } })).map((a) => a.action).sort();
    expect(actions).toEqual(["association.created", "registration.approved", "user.created"]);

    expect(await approveRegistration(admin, row.id, "")).toMatchObject({ ok: false });
    expect((await lookupRegistration(referenceNo, input.licenseNumber))?.username).toBe(input.username);
  });

  it("approval is refused when the username was taken meanwhile, leaving the application pending", async () => {
    const { row, input } = await submitted();
    await db.user.update({ where: { id: ctx.users.manager.id }, data: { username: input.username } });
    expect((await approveRegistration(admin, row.id, "")).ok).toBe(false);
    expect((await db.associationRegistration.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("PENDING");
    expect(await db.association.count()).toBe(1);
  });

  it("rejection needs a reason, discards the password and shows the reason in the public lookup", async () => {
    const { row, input, referenceNo } = await submitted();
    expect(await rejectRegistration(admin, row.id, "")).toMatchObject({ ok: false });
    expect((await rejectRegistration(admin, row.id, "رقم الترخيص لا يطابق السجل")).ok).toBe(true);
    const reg = await db.associationRegistration.findUniqueOrThrow({ where: { id: row.id } });
    expect(reg.status).toBe("REJECTED");
    expect(reg.passwordHash).toBeNull();

    const lookup = await lookupRegistration(referenceNo, input.licenseNumber);
    expect(lookup).toMatchObject({ status: "REJECTED", note: "رقم الترخيص لا يطابق السجل", username: null });
    expect(await lookupRegistration(referenceNo, "0000")).toBeNull();

    // The license is free again for a corrected application.
    expect((await submitRegistration(application({ licenseNumber: input.licenseNumber }))).ok).toBe(true);
  });
});

describe("checking a step before submission", () => {
  it("reports a license under review and a taken username, and passes free ones", async () => {
    const { input } = await submitted();
    expect(await checkRegistrationAvailability({ licenseNumber: input.licenseNumber })).toMatchObject({ ok: false, errors: { licenseNumber: expect.any(String) } });
    expect(await checkRegistrationAvailability({ username: input.username })).toMatchObject({ ok: false, errors: { username: expect.any(String) } });
    expect(await checkRegistrationAvailability({ licenseNumber: "99999", username: "free.name" })).toEqual({ ok: true });
    expect(await checkRegistrationAvailability({})).toEqual({ ok: true });
  });
});
