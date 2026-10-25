// Account creation shared by the seed scripts and (from Phase 2) the admin area.
// Rifada has no public sign-up, so accounts are written directly in the Better Auth layout:
// a `users` row plus a `credential` account holding the argon2 hash.
// This module deliberately avoids `server-only` so tsx seed scripts can import it.

import type { Prisma, PrismaClient, Role } from "@/generated/prisma/client";
import { hashPassword } from "./password";
import { placeholderEmail } from "./placeholder-email";

type Client = Pick<PrismaClient, "user" | "account"> | Prisma.TransactionClient;

export type NewUser = {
  username: string;
  name: string;
  role: Role;
  password: string;
  email?: string | null;
  phone?: string | null;
  associationId?: string | null;
  nationalId?: string | null;
  mustChangePassword?: boolean;
  isDemo?: boolean;
};

export async function createUserWithPassword(client: Client, input: NewUser) {
  const username = input.username.trim().toLowerCase();
  const user = await client.user.create({
    data: {
      username,
      name: input.name,
      email: input.email?.trim().toLowerCase() || placeholderEmail(username),
      phone: input.phone?.trim() || null,
      role: input.role,
      associationId: input.associationId ?? null,
      nationalId: input.nationalId ?? null,
      mustChangePassword: input.mustChangePassword ?? true,
      isDemo: input.isDemo ?? false,
    },
  });
  await client.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: await hashPassword(input.password),
    },
  });
  return user;
}

/** Replaces the credential password hash (creating the credential account if missing). */
export async function setCredentialPassword(client: Client, userId: string, password: string) {
  const digest = await hashPassword(password);
  const updated = await client.account.updateMany({
    where: { userId, providerId: "credential" },
    data: { password: digest },
  });
  if (updated.count === 0) {
    await client.account.create({ data: { userId, accountId: userId, providerId: "credential", password: digest } });
  }
}

/** Ends every session of the user; the next request from them is signed out. */
export async function revokeSessions(client: Pick<PrismaClient, "session"> | Prisma.TransactionClient, userId: string) {
  const { count } = await client.session.deleteMany({ where: { userId } });
  return count;
}
