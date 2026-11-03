// Fixtures for the Phase 2a admin tests: real rows, so audit and foreign keys behave as in the app.

import type { Role } from "@/generated/prisma/client";
import { createUserWithPassword } from "@/server/auth/users";
import type { Actor } from "@/server/authz/scope";
import { db } from "./db";

export const TEST_PASSWORD = "test-pass-2026";
let counter = 0;

export async function makeUser(role: Role, extra: { username?: string; associationId?: string | null; trackIds?: string[]; isActive?: boolean } = {}) {
  counter += 1;
  const user = await createUserWithPassword(db, {
    username: extra.username ?? `${role.toLowerCase()}.${counter}`,
    name: `مستخدم ${counter}`,
    role,
    password: TEST_PASSWORD,
    associationId: extra.associationId ?? null,
    mustChangePassword: false,
  });
  if (extra.trackIds?.length) {
    await db.supervisorTrack.createMany({ data: extra.trackIds.map((trackId) => ({ userId: user.id, trackId })) });
  }
  if (extra.isActive === false) await db.user.update({ where: { id: user.id }, data: { isActive: false } });
  return user;
}

export function actorOf(user: { id: string; role: Role; associationId: string | null }, trackIds: string[] = []): Actor {
  return { id: user.id, role: user.role, associationId: user.associationId, trackIds };
}

/** One actor per role, with an association for the officer and a track for the supervisor. */
export async function makeRoleActors() {
  const programs = await makePrograms();
  const tracks = await makeTracks(programs);
  const association = await makeAssociation("جمعية المسؤول");
  const admin = await makeUser("SUPER_ADMIN");
  const manager = await makeUser("UNIT_MANAGER");
  const supervisor = await makeUser("SUPERVISOR", { trackIds: [tracks[0].id] });
  const officer = await makeUser("ASSOCIATION_OFFICER", { associationId: association.id });
  return {
    programs,
    tracks,
    association,
    users: { admin, manager, supervisor, officer },
    actors: {
      SUPER_ADMIN: actorOf(admin),
      UNIT_MANAGER: actorOf(manager),
      SUPERVISOR: actorOf(supervisor, [tracks[0].id]),
      ASSOCIATION_OFFICER: actorOf(officer),
    } satisfies Record<Role, Actor>,
  };
}

export async function makePrograms(count = 7) {
  const existing = await db.program.findMany({ orderBy: { number: "asc" } });
  if (existing.length >= count) return existing;
  for (let number = existing.length + 1; number <= count; number++) {
    await db.program.create({ data: { number, name: `البرنامج ${number}`, sortOrder: number } });
  }
  return db.program.findMany({ orderBy: { number: "asc" } });
}

/** Five tracks, track n holding programme n (D-123). */
export async function makeTracks(programs: { id: string }[]) {
  const existing = await db.track.findMany({ orderBy: { number: "asc" } });
  if (existing.length >= 5) return existing;
  for (let number = existing.length + 1; number <= 5; number++) {
    await db.track.create({ data: { number, name: `المسار ${number}`, sortOrder: number, programs: { create: [{ programId: programs[number - 1].id }] } } });
  }
  return db.track.findMany({ orderBy: { number: "asc" } });
}

/** The request types of the design handoff (the migration's rows are emptied between tests). */
export async function makeRequestTypes() {
  const existing = await db.requestType.findMany({ orderBy: { sortOrder: "asc" } });
  if (existing.length) return existing;
  for (const [i, name] of ["اعتماد مشروع/برنامج", "تصريح إقامة نشاط", "طلب محفزات وممكنات"].entries()) {
    await db.requestType.create({ data: { name, sortOrder: i + 1 } });
  }
  return db.requestType.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function makeAssociation(name: string, extra: { licenseNumber?: string; isActive?: boolean } = {}) {
  return db.association.create({
    data: {
      name,
      licenseNumber: extra.licenseNumber ?? null,
      contactName: "مسؤول التواصل",
      contactEmail: "contact@example.org",
      contactPhone: "0500000000",
      isActive: extra.isActive ?? true,
    },
  });
}

export const userInput = (overrides: Record<string, unknown> = {}) => ({
  username: `new.user.${++counter}`,
  name: "عبدالله بن محمد",
  email: null,
  phone: null,
  role: "UNIT_MANAGER" as Role,
  trackIds: [] as string[],
  associationId: null as string | null,
  ...overrides,
});

export const associationInput = (overrides: Record<string, unknown> = {}) => ({
  name: `جمعية رقم ${++counter}`,
  licenseNumber: null as string | null,
  city: "مكة المكرمة",
  region: "منطقة مكة المكرمة",
  classification: null as string | null,
  contactName: "سعد العتيبي",
  contactEmail: "info@example.org",
  contactPhone: "0555555555",
  ...overrides,
});
