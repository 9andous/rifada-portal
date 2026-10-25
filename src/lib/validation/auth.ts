import * as z from "zod";

// Kept in sync with PASSWORD_MIN_LENGTH in src/server/auth/password.ts (asserted by a unit test).
export const PASSWORD_MIN = 10;

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `يجب ألا تقل كلمة المرور عن ${PASSWORD_MIN} أحرف.`)
  .max(128, "كلمة المرور طويلة جدًا.")
  .regex(/[A-Za-z]/, "يجب أن تحتوي كلمة المرور على حرف لاتيني واحد على الأقل.")
  .regex(/\d/, "يجب أن تحتوي كلمة المرور على رقم واحد على الأقل.");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "أدخل كلمة المرور الحالية."),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "كلمتا المرور غير متطابقتين.",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "اختر كلمة مرور مختلفة عن الحالية.",
  });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "كلمتا المرور غير متطابقتين.",
  });

export const forgotPasswordSchema = z.object({
  username: z.string().trim().min(1, "أدخل اسم المستخدم."),
});

export type FieldErrors = Partial<Record<string, string>>;

/** First error message per field, for rendering next to inputs. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
