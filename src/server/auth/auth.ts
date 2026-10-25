import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db } from "@/server/db";
import { nafathMock } from "@/server/identity/nafath-mock-plugin";
import { emailService } from "@/server/services/email";
import { PASSWORD_MIN_LENGTH, hashPassword, verifyPassword } from "./password";

export const auth = betterAuth({
  appName: "رفادة",
  database: prismaAdapter(db, { provider: "postgresql" }),
  // Profile and account self-service is handled by Rifada's own audited actions.
  disabledPaths: [
    "/sign-up/email",
    "/is-username-available",
    "/update-user",
    "/change-email",
    "/delete-user",
    "/set-password",
    "/link-social",
    "/unlink-account",
  ],
  telemetry: { enabled: false },
  emailAndPassword: {
    enabled: true,
    // No public sign-up: accounts are created by the super admin only.
    disableSignUp: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    password: { hash: hashPassword, verify: verifyPassword },
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await emailService.send({
        to: user.email,
        subject: "إعادة تعيين كلمة المرور — رفادة",
        text: `لإعادة تعيين كلمة المرور افتح الرابط التالي خلال ساعة:\n${url}`,
      });
    },
    onPasswordReset: async ({ user }) => {
      await db.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
      await db.auditLog.create({
        data: { actorId: user.id, action: "auth.password_reset", entityType: "User", entityId: user.id },
      });
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, required: true },
      associationId: { type: "string", input: false, required: false },
      nationalId: { type: "string", input: false, required: false },
      mustChangePassword: { type: "boolean", input: false, required: false },
      isActive: { type: "boolean", input: false, required: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 60,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/username": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
      "/reset-password": { window: 300, max: 5 },
      "/change-password": { window: 300, max: 5 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Deactivated accounts cannot obtain a session by any sign-in method.
        before: async (session) => {
          const user = await db.user.findUnique({ where: { id: session.userId }, select: { isActive: true } });
          return user?.isActive === true;
        },
        after: async (session) => {
          await db.user.update({ where: { id: session.userId }, data: { lastLoginAt: new Date() } });
          await db.auditLog.create({
            data: {
              actorId: session.userId,
              action: "auth.login",
              entityType: "Session",
              entityId: session.id,
              ip: session.ipAddress ?? null,
              userAgent: session.userAgent ?? null,
            },
          });
        },
      },
    },
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 40, displayUsername: false }),
    nafathMock(),
    // Must stay last so server actions can set auth cookies.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
