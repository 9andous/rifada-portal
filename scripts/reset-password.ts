// Break-glass password reset for local administration:
//   npm run user:reset-password -- <username>
// Generates a random temporary password, prints it once, stores only its argon2 hash,
// turns mustChangePassword on, revokes the user's sessions and writes an audit entry.

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/server/auth/password";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

/** 16 characters from an unambiguous alphabet, always with a letter and a digit. */
function temporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(14);
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${body}${"abcdefghjkmnpqrstuvwxyz"[bytes[0] % 23]}${"23456789"[bytes[1] % 8]}`;
}

async function main() {
  const username = process.argv[2]?.trim().toLowerCase();
  if (!username) throw new Error("Usage: npm run user:reset-password -- <username>");

  const user = await db.user.findUnique({ where: { username }, select: { id: true } });
  if (!user) throw new Error(`No user named "${username}".`);

  const password = temporaryPassword();
  const hash = await hashPassword(password);
  await db.$transaction([
    db.account.updateMany({ where: { userId: user.id, providerId: "credential" }, data: { password: hash } }),
    db.user.update({ where: { id: user.id }, data: { mustChangePassword: true } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.auditLog.create({
      data: { actorId: null, action: "auth.password_reset_by_script", entityType: "User", entityId: user.id },
    }),
  ]);

  console.log(`Temporary password for "${username}" (shown once, not stored): ${password}`);
  console.log("The user must change it at next login. All of the user's sessions were signed out.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
