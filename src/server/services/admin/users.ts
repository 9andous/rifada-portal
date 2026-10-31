import "server-only";
import { imageUrl } from "@/lib/images";
import type { Prisma, Role } from "@/generated/prisma/client";
import { enumParam, pageWindow, parseListParams, type Page, type SearchParams } from "@/lib/list-params";
import type { UserFormInput } from "@/lib/validation/admin";
import { isPlaceholderEmail, placeholderEmail } from "@/server/auth/placeholder-email";
import { generateTemporaryPassword } from "@/server/auth/temp-password";
import { createUserWithPassword, revokeSessions, setCredentialPassword } from "@/server/auth/users";
import { ROLES } from "@/server/authz/roles";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { PAGE_SIZE, assertCan, containsAny, fieldRefusal, lockAdminWrites, refuse, type Result } from "./common";

// ---------------------------------------------------------------------------
// Audit snapshots: an explicit allow-list, so no credential field can ever be recorded.
// ---------------------------------------------------------------------------

type SnapshotSource = {
  username: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  associationId: string | null;
  mustChangePassword: boolean;
};

export function userSnapshot(user: SnapshotSource, trackIds: readonly string[] = []) {
  return {
    username: user.username,
    name: user.name,
    email: isPlaceholderEmail(user.email) ? null : user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    associationId: user.associationId,
    trackIds: [...trackIds].sort(),
    mustChangePassword: user.mustChangePassword,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const USER_SORTS = ["name", "username", "role", "createdAt", "lastLoginAt"] as const;
export type UserSort = (typeof USER_SORTS)[number];
export const USER_STATUSES = ["active", "inactive"] as const;
/** The users page's two tabs: the platform's own team, and the association officers. */
export const USER_TABS = ["staff", "officers"] as const;
export type UserTab = (typeof USER_TABS)[number];
export const STAFF_ROLES = ROLES.filter((r) => r !== "ASSOCIATION_OFFICER");

export function parseUserListParams(params: SearchParams) {
  return {
    ...parseListParams(params, USER_SORTS, { sort: "name", dir: "asc" }),
    tab: enumParam(params, "tab", USER_TABS) ?? "staff",
    role: enumParam(params, "role", ROLES),
    status: enumParam(params, "status", USER_STATUSES),
    track: typeof params.track === "string" && params.track ? params.track : undefined,
  };
}

export type UserListParams = ReturnType<typeof parseUserListParams>;

export type UserRow = {
  id: string;
  username: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  associationName: string | null;
  trackNumbers: number[];
  /** The user's picture, or for an officer without one, the association's logo. */
  imageUrl: string | null;
};

export async function listUsers(actor: Actor, params: UserListParams): Promise<Page<UserRow>> {
  assertCan(actor, "users.manage");
  const where: Prisma.UserWhereInput = {};
  if (params.q) where.OR = containsAny(params.q, ["username", "name", "email", "phone"] as const);
  // Each tab lists its own kind of account; the role filter narrows the team tab only.
  if (params.tab === "officers") where.role = "ASSOCIATION_OFFICER";
  else where.role = params.role && params.role !== "ASSOCIATION_OFFICER" ? params.role : { not: "ASSOCIATION_OFFICER" };
  if (params.status) where.isActive = params.status === "active";
  if (params.track) where.supervisedTracks = { some: { trackId: params.track } };

  const total = await db.user.count({ where });
  const win = pageWindow(total, params.page, PAGE_SIZE);
  const nulls = params.sort === "lastLoginAt" ? { sort: params.dir, nulls: "last" as const } : params.dir;
  const users = await db.user.findMany({
    where,
    orderBy: [{ [params.sort]: nulls }, { id: "asc" }],
    skip: win.skip,
    take: win.take,
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
      avatarKey: true,
      associationId: true,
      association: { select: { name: true, logoKey: true } },
      supervisedTracks: { select: { track: { select: { number: true } } } },
    },
  });

  return {
    items: users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      email: isPlaceholderEmail(u.email) ? null : u.email,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      associationName: u.association?.name ?? null,
      trackNumbers: u.supervisedTracks.map((t) => t.track.number).sort((a, b) => a - b),
      imageUrl: imageUrl("user", u.id, u.avatarKey) ?? (u.associationId ? imageUrl("association", u.associationId, u.association?.logoKey) : null),
    })),
    total,
    page: win.page,
    pageSize: PAGE_SIZE,
    pageCount: win.pageCount,
  };
}

/** Figures for the users band: totals per role and status. */
export async function userFigures(actor: Actor) {
  assertCan(actor, "users.manage");
  const groups = await db.user.groupBy({ by: ["role", "isActive"], _count: { _all: true } });
  const count = (pred: (g: (typeof groups)[number]) => boolean) => groups.filter(pred).reduce((s, g) => s + g._count._all, 0);
  return {
    total: count(() => true),
    active: count((g) => g.isActive),
    inactive: count((g) => !g.isActive),
    /** All accounts per tab, active or not. */
    staff: count((g) => g.role !== "ASSOCIATION_OFFICER"),
    officers: count((g) => g.role === "ASSOCIATION_OFFICER"),
    byRole: Object.fromEntries(ROLES.map((r) => [r, count((g) => g.role === r && g.isActive)])) as Record<Role, number>,
  };
}

/** Tracks and associations the user form offers. Associations with an officer are excluded, except `keepAssociationId`. */
export async function userFormOptions(actor: Actor, keepAssociationId?: string | null) {
  assertCan(actor, "users.manage");
  const [tracks, associations] = await Promise.all([
    db.track.findMany({ where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { number: "asc" }], select: { id: true, number: true, name: true } }),
    db.association.findMany({
      where: { OR: [{ officer: null, isActive: true }, ...(keepAssociationId ? [{ id: keepAssociationId }] : [])] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { tracks, associations };
}

export async function getUserDetail(actor: Actor, id: string) {
  assertCan(actor, "users.manage");
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      isDemo: true,
      avatarKey: true,
      associationId: true,
      association: { select: { id: true, name: true, isActive: true } },
      supervisedTracks: { select: { trackId: true } },
      _count: { select: { sessions: true } },
    },
  });
  if (!user) return null;
  const history = await db.auditLog.findMany({
    where: { entityType: "User", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, action: true, createdAt: true, actor: { select: { name: true } } },
  });
  return {
    ...user,
    email: isPlaceholderEmail(user.email) ? null : user.email,
    trackIds: user.supervisedTracks.map((t) => t.trackId),
    activeSessions: user._count.sessions,
    history,
  };
}

export type UserDetail = NonNullable<Awaited<ReturnType<typeof getUserDetail>>>;

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const MSG = {
  usernameTaken: "اسم المستخدم مستخدم لحساب آخر.",
  emailTaken: "البريد الإلكتروني مسجل لحساب آخر.",
  associationMissing: "الجمعية المختارة غير موجودة.",
  associationInactive: "الجمعية المختارة معطلة؛ فعّلها أولًا.",
  associationTaken: "لهذه الجمعية حساب مسؤول بالفعل، ولكل جمعية حساب واحد فقط.",
  tracksInvalid: "أحد المسارات المختارة غير متاح.",
  notFound: "الحساب غير موجود.",
  selfRole: "لا يمكنك تغيير دور حسابك.",
  selfDeactivate: "لا يمكنك تعطيل حسابك.",
  selfReset: "لا يمكنك إعادة تعيين كلمة مرور حسابك من هنا؛ استخدم صفحة تغيير كلمة المرور.",
  lastAdmin: "هذا آخر حساب نشط بدور مدير النظام؛ أنشئ حساب مدير نظام آخر أو فعّله قبل هذا التغيير.",
  officerRoleChange: "لا يمكن تحويل حساب مسؤول جمعية إلى دور آخر أو العكس؛ عطّل الحساب وأنشئ حسابًا جديدًا بالدور المطلوب.",
  officerOfInactiveAssociation: "الجمعية المرتبطة بهذا الحساب معطلة؛ فعّل الجمعية أولًا.",
} as const;

type Tx = Prisma.TransactionClient;

async function checkUnique(tx: Tx, input: { username: string; email: string | null }, exceptId?: string): Promise<Result> {
  const notSelf = exceptId ? { id: { not: exceptId } } : {};
  if (await tx.user.findFirst({ where: { username: input.username, ...notSelf }, select: { id: true } })) {
    return fieldRefusal("username", MSG.usernameTaken);
  }
  const email = input.email ?? placeholderEmail(input.username);
  if (await tx.user.findFirst({ where: { email, ...notSelf }, select: { id: true } })) {
    return fieldRefusal(input.email ? "email" : "username", input.email ? MSG.emailTaken : MSG.usernameTaken);
  }
  return { ok: true };
}

async function checkTracks(tx: Tx, trackIds: readonly string[]): Promise<Result> {
  if (trackIds.length === 0) return { ok: true };
  const found = await tx.track.count({ where: { id: { in: [...trackIds] }, archivedAt: null } });
  return found === trackIds.length ? { ok: true } : fieldRefusal("trackIds", MSG.tracksInvalid);
}

/** The association must exist, be active and have no officer other than `exceptUserId`. */
export async function checkAssociationFree(tx: Tx, associationId: string, exceptUserId?: string): Promise<Result> {
  const association = await tx.association.findUnique({
    where: { id: associationId },
    select: { isActive: true, officer: { select: { id: true } } },
  });
  if (!association) return fieldRefusal("associationId", MSG.associationMissing);
  if (!association.isActive) return fieldRefusal("associationId", MSG.associationInactive);
  if (association.officer && association.officer.id !== exceptUserId) return fieldRefusal("associationId", MSG.associationTaken);
  return { ok: true };
}

async function otherActiveSuperAdmins(tx: Tx, exceptId: string): Promise<number> {
  return tx.user.count({ where: { role: "SUPER_ADMIN", isActive: true, id: { not: exceptId } } });
}

function firstRefusal(...results: Result[]): Result {
  return results.find((r) => !r.ok) ?? { ok: true };
}

export async function createUser(actor: Actor, input: UserFormInput): Promise<Result<{ userId: string; username: string; password: string }>> {
  assertCan(actor, "users.manage");
  const password = generateTemporaryPassword();

  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const check = firstRefusal(
      await checkUnique(tx, input),
      await checkTracks(tx, input.trackIds),
      input.associationId ? await checkAssociationFree(tx, input.associationId) : { ok: true },
    );
    if (!check.ok) return check;

    const user = await createUserWithPassword(tx, {
      username: input.username,
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      associationId: input.associationId,
      password,
      mustChangePassword: true,
    });
    if (input.trackIds.length > 0) {
      await tx.supervisorTrack.createMany({ data: input.trackIds.map((trackId) => ({ userId: user.id, trackId })) });
    }
    await audit(
      { actorId: actor.id, action: "user.created", entityType: "User", entityId: user.id, after: userSnapshot(user, input.trackIds) },
      tx,
    );
    return { ok: true, userId: user.id, username: user.username ?? input.username, password };
  });
}

export async function updateUser(actor: Actor, id: string, input: UserFormInput): Promise<Result> {
  assertCan(actor, "users.manage");

  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const current = await tx.user.findUnique({ where: { id }, include: { supervisedTracks: { select: { trackId: true } } } });
    if (!current) return refuse(MSG.notFound);
    const currentTracks = current.supervisedTracks.map((t) => t.trackId);

    if (current.role !== input.role) {
      if (id === actor.id) return fieldRefusal("role", MSG.selfRole);
      if ((current.role === "ASSOCIATION_OFFICER") !== (input.role === "ASSOCIATION_OFFICER")) return fieldRefusal("role", MSG.officerRoleChange);
      if (current.role === "SUPER_ADMIN" && current.isActive && (await otherActiveSuperAdmins(tx, id)) === 0) {
        return fieldRefusal("role", MSG.lastAdmin);
      }
    }

    const check = firstRefusal(
      await checkUnique(tx, input, id),
      await checkTracks(tx, input.trackIds),
      input.associationId && input.associationId !== current.associationId ? await checkAssociationFree(tx, input.associationId, id) : { ok: true },
    );
    if (!check.ok) return check;

    const updated = await tx.user.update({
      where: { id },
      data: {
        username: input.username,
        name: input.name,
        email: input.email ?? placeholderEmail(input.username),
        phone: input.phone,
        role: input.role,
        associationId: input.associationId,
      },
    });
    await tx.supervisorTrack.deleteMany({ where: { userId: id, trackId: { notIn: input.trackIds } } });
    const toAdd = input.trackIds.filter((t) => !currentTracks.includes(t));
    if (toAdd.length > 0) await tx.supervisorTrack.createMany({ data: toAdd.map((trackId) => ({ userId: id, trackId })) });

    const before = userSnapshot(current, currentTracks);
    const after = userSnapshot(updated, input.trackIds);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await audit({ actorId: actor.id, action: "user.updated", entityType: "User", entityId: id, before, after }, tx);
    }
    return { ok: true };
  });
}

export async function setUserActive(actor: Actor, id: string, active: boolean): Promise<Result<{ revokedSessions: number }>> {
  assertCan(actor, "users.manage");

  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const current = await tx.user.findUnique({ where: { id }, include: { association: { select: { isActive: true } } } });
    if (!current) return refuse(MSG.notFound);
    if (current.isActive === active) return { ok: true, revokedSessions: 0 };

    if (!active) {
      if (id === actor.id) return refuse(MSG.selfDeactivate);
      if (current.role === "SUPER_ADMIN" && (await otherActiveSuperAdmins(tx, id)) === 0) return refuse(MSG.lastAdmin);
    } else if (current.association && !current.association.isActive) {
      return refuse(MSG.officerOfInactiveAssociation);
    }

    const updated = await tx.user.update({ where: { id }, data: { isActive: active } });
    const revokedSessions = active ? 0 : await revokeSessions(tx, id);
    await audit(
      {
        actorId: actor.id,
        action: active ? "user.reactivated" : "user.deactivated",
        entityType: "User",
        entityId: id,
        before: { isActive: current.isActive },
        after: { isActive: updated.isActive, ...(active ? {} : { revokedSessions }) },
      },
      tx,
    );
    return { ok: true, revokedSessions };
  });
}

export async function resetUserPassword(actor: Actor, id: string): Promise<Result<{ username: string; password: string }>> {
  assertCan(actor, "users.manage");
  if (id === actor.id) return refuse(MSG.selfReset);
  const password = generateTemporaryPassword();

  return db.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id }, select: { id: true, username: true, mustChangePassword: true } });
    if (!current) return refuse(MSG.notFound);
    await setCredentialPassword(tx, id, password);
    await tx.user.update({ where: { id }, data: { mustChangePassword: true } });
    const revokedSessions = await revokeSessions(tx, id);
    await audit(
      {
        actorId: actor.id,
        action: "user.password_reset",
        entityType: "User",
        entityId: id,
        before: { mustChangePassword: current.mustChangePassword },
        after: { mustChangePassword: true, revokedSessions },
      },
      tx,
    );
    return { ok: true, username: current.username ?? "", password };
  });
}
