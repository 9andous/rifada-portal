// Shared validation for the user and association forms (server actions and tests use the same schemas).

import * as z from "zod";
import { ROLES } from "@/server/authz/roles";

/** Arabic-Indic and Extended Arabic-Indic digits to ASCII, so «٠٥٥…» validates as a phone number. */
export function toWesternDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Trimmed text; an empty string becomes null. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} طويل جدًا.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "يجب ألا يقل اسم المستخدم عن ثلاثة أحرف.")
  .max(40, "يجب ألا يزيد اسم المستخدم على ٤٠ حرفًا.")
  // Same character set as Better Auth's username plugin (letters, digits, "_" and "."), or the
  // account could not sign in.
  .regex(/^[a-z0-9][a-z0-9._]*$/, "يتكون اسم المستخدم من أحرف لاتينية صغيرة وأرقام والرمزين . و _ ويبدأ بحرف أو رقم.");

export const fullNameSchema = z.string().trim().min(2, "أدخل الاسم الكامل.").max(100, "الاسم طويل جدًا.");

const emailSchema = z.email("أدخل بريدًا إلكترونيًا صحيحًا.").max(254, "البريد الإلكتروني طويل جدًا.");

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === "" ? null : v))
  .pipe(emailSchema.nullable())
  .nullable()
  .default(null);

const PHONE = /^\+?[0-9][0-9 -]{6,18}$/;
const phoneMessage = "أدخل رقم هاتف صحيحًا (أرقام فقط، ويجوز أن يبدأ بعلامة +).";

export const optionalPhone = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : toWesternDigits(v)))
  .refine((v) => v === null || PHONE.test(v), phoneMessage)
  .nullable()
  .default(null);

const roleSchema = z.enum(ROLES, { error: "اختر الدور." });

export const userFormSchema = z
  .object({
    username: usernameSchema,
    name: fullNameSchema,
    email: optionalEmail,
    phone: optionalPhone,
    role: roleSchema,
    programIds: z.array(z.string().min(1)).default([]),
    associationId: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .default(null),
  })
  .superRefine((v, ctx) => {
    if (v.role === "SUPERVISOR" && v.programIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["programIds"], message: "اختر برنامجًا واحدًا على الأقل للمشرف." });
    }
    if (v.role === "ASSOCIATION_OFFICER" && !v.associationId) {
      ctx.addIssue({ code: "custom", path: ["associationId"], message: "اختر الجمعية التي يمثلها هذا الحساب." });
    }
  })
  .transform((v) => ({
    ...v,
    programIds: v.role === "SUPERVISOR" ? [...new Set(v.programIds)] : [],
    associationId: v.role === "ASSOCIATION_OFFICER" ? v.associationId : null,
  }));

export type UserFormInput = z.infer<typeof userFormSchema>;

export const associationFormSchema = z.object({
  name: z.string().trim().min(3, "أدخل اسم الجمعية.").max(150, "اسم الجمعية طويل جدًا."),
  licenseNumber: optionalText(50, "رقم الترخيص").transform((v) => (v === null ? null : toWesternDigits(v))),
  city: optionalText(80, "اسم المدينة"),
  region: optionalText(80, "اسم المنطقة"),
  classification: optionalText(80, "التصنيف"),
  contactName: fullNameSchema.max(100, "اسم مسؤول التواصل طويل جدًا."),
  contactEmail: optionalEmail,
  contactPhone: optionalPhone,
});

export type AssociationFormInput = z.infer<typeof associationFormSchema>;

/** The optional officer account created together with a new association. */
export const officerFormSchema = z.object({
  username: usernameSchema,
  name: fullNameSchema,
  email: optionalEmail,
  phone: optionalPhone,
});

export type OfficerFormInput = z.infer<typeof officerFormSchema>;

/** Reads a FormData into a plain object, keeping repeated keys (checkbox groups) as arrays. */
export function formObject(formData: FormData, arrayKeys: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) continue; // React's internal action fields
    out[key] = arrayKeys.includes(key) ? formData.getAll(key).map(String) : String(formData.get(key) ?? "");
  }
  for (const key of arrayKeys) out[key] ??= [];
  return out;
}
