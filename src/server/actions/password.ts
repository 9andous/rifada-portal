"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import {
  changePasswordSchema,
  fieldErrors,
  forgotPasswordSchema,
  resetPasswordSchema,
  type FieldErrors,
} from "@/lib/validation/auth";
import { auth } from "@/server/auth/auth";
import { homeFor, requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { rateLimit } from "@/server/services/rate-limit";

export type FormState = { ok?: boolean; message?: string; errors?: FieldErrors };

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

const GENERIC_RESET_MESSAGE =
  "إن كان اسم المستخدم مسجلًا ولديه بريد إلكتروني معتمد فستصله رسالة تتضمن رابط إعادة التعيين خلال دقائق.";

export async function requestPasswordResetAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ username: formData.get("username") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  if (!rateLimit(`forgot:${await clientKey()}`, 3, 5 * 60_000)) {
    return { message: "تجاوزت عدد المحاولات المسموح بها. انتظر بضع دقائق ثم حاول مرة أخرى." };
  }

  const user = await db.user.findUnique({
    where: { username: parsed.data.username.toLowerCase() },
    select: { id: true, email: true, isActive: true },
  });
  if (user?.isActive) {
    await auth.api.requestPasswordReset({
      body: { email: user.email, redirectTo: "/reset-password" },
      headers: await headers(),
    });
    await audit({ actorId: null, action: "auth.password_reset_requested", entityType: "User", entityId: user.id });
  }
  // Same answer whether or not the account exists.
  return { ok: true, message: GENERIC_RESET_MESSAGE };
}

export async function resetPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  if (!rateLimit(`reset:${await clientKey()}`, 5, 5 * 60_000)) {
    return { message: "تجاوزت عدد المحاولات المسموح بها. انتظر بضع دقائق ثم حاول مرة أخرى." };
  }

  try {
    await auth.api.resetPassword({ body: { token: parsed.data.token, newPassword: parsed.data.newPassword } });
  } catch (error) {
    if (error instanceof APIError) {
      return { message: "رابط إعادة التعيين غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا." };
    }
    throw error;
  }
  return { ok: true, message: "تم تعيين كلمة المرور الجديدة. يمكنك الآن تسجيل الدخول." };
}

export async function changePasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ allowPasswordChange: true });
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  if (!rateLimit(`change:${user.id}`, 5, 5 * 60_000)) {
    return { message: "تجاوزت عدد المحاولات المسموح بها. انتظر بضع دقائق ثم حاول مرة أخرى." };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { errors: { currentPassword: "كلمة المرور الحالية غير صحيحة." } };
    }
    throw error;
  }

  await db.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
  await audit({ actorId: user.id, action: "auth.password_changed", entityType: "User", entityId: user.id });
  redirect(homeFor(user));
}
