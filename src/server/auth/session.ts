import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { imageUrl } from "@/lib/images";
import { db } from "@/server/db";
import { isRole, ROLE_HOME, type Role } from "@/server/authz/roles";
import type { Actor } from "@/server/authz/scope";
import { auth } from "./auth";

export type CurrentUser = Actor & {
  name: string;
  username: string | null;
  email: string;
  mustChangePassword: boolean;
  associationName: string | null;
  /** The user's picture, or for an association officer without one, the association's logo. */
  imageUrl: string | null;
};

/** Resolves the signed-in, active user once per request, or null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => (await userFromHeaders(await headers()))?.user ?? null);

/**
 * The signed-in, active user for a route handler's request (route handlers answer 401/403 instead
 * of redirecting). Also returns the session id, e.g. to record who staged an upload.
 */
export async function userFromRequest(request: Request): Promise<{ user: CurrentUser; sessionId: string } | null> {
  return userFromHeaders(request.headers);
}

async function userFromHeaders(requestHeaders: Headers): Promise<{ user: CurrentUser; sessionId: string } | null> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      avatarKey: true,
      associationId: true,
      association: { select: { name: true, logoKey: true } },
      supervisedTracks: { select: { trackId: true } },
    },
  });
  if (!user || !user.isActive || !isRole(user.role)) return null;

  const current: CurrentUser = {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    associationId: user.associationId,
    associationName: user.association?.name ?? null,
    imageUrl:
      imageUrl("user", user.id, user.avatarKey) ??
      (user.associationId ? imageUrl("association", user.associationId, user.association?.logoKey) : null),
    trackIds: user.supervisedTracks.map((t) => t.trackId),
    mustChangePassword: user.mustChangePassword,
  };
  return { user: current, sessionId: session.session.id };
}

/** For pages and actions that need a signed-in user. Enforces the first-login password change. */
export async function requireUser(options: { allowPasswordChange?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options.allowPasswordChange) redirect("/account/change-password");
  return user;
}

/** Returns the user when their role is allowed, otherwise null so the caller renders a 403 state. */
export async function requireRole(roles: readonly Role[]): Promise<CurrentUser | null> {
  const user = await requireUser();
  return roles.includes(user.role) ? user : null;
}

export function homeFor(user: Pick<CurrentUser, "role">): string {
  return ROLE_HOME[user.role];
}
