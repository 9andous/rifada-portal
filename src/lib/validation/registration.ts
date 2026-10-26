// Validation for the public association registration (D-094). Shared by the server action, the
// service and the tests.

import * as z from "zod";
import { fullNameSchema, optionalEmail, toWesternDigits, usernameSchema } from "./admin";
import { newPasswordSchema } from "./auth";

/** Classifications of the supervision initiative (initiative document, page 3), plus «أخرى». */
export const REGISTRATION_CLASSIFICATIONS = [
  "منظمات خدمة ضيوف الرحمن",
  "منظمات الدعوة والإرشاد والتعليم الديني",
  "البحوث العلمية والمطبوعات والترجمة بالحرمين الشريفين",
  "أخرى",
] as const;

export const SAUDI_REGIONS = [
  "منطقة مكة المكرمة",
  "منطقة المدينة المنورة",
  "منطقة الرياض",
  "المنطقة الشرقية",
  "منطقة القصيم",
  "منطقة عسير",
  "منطقة تبوك",
  "منطقة حائل",
  "منطقة الحدود الشمالية",
  "منطقة جازان",
  "منطقة نجران",
  "منطقة الباحة",
  "منطقة الجوف",
] as const;

const PHONE = /^(\+?966|0)?5[0-9]{8}$/;
const requiredPhone = z
  .string()
  .trim()
  .transform((v) => toWesternDigits(v).replace(/[\s-]/g, ""))
  .refine((v) => PHONE.test(v), "أدخل رقم جوال سعوديًا صحيحًا، مثل ٠٥٠١٢٣٤٥٦٧.");

const optionalUrl = z
  .string()
  .trim()
  .max(200, "الرابط طويل جدًا.")
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "أدخل رابطًا يبدأ بـ https://")
  .nullable()
  .default(null);

export const registrationSchema = z
  .object({
    name: z.string().trim().min(3, "أدخل اسم الجمعية كما في الترخيص.").max(150, "اسم الجمعية طويل جدًا."),
    licenseNumber: z
      .string()
      .trim()
      .transform(toWesternDigits)
      .pipe(z.string().regex(/^[0-9]{1,10}$/, "رقم الترخيص أرقام فقط، كما في شهادة تسجيل المركز الوطني لتنمية القطاع غير الربحي.")),
    classification: z.enum(REGISTRATION_CLASSIFICATIONS, { error: "اختر تصنيف الجمعية." }),
    region: z.enum(SAUDI_REGIONS, { error: "اختر المنطقة." }),
    city: z.string().trim().min(2, "أدخل المدينة.").max(80, "اسم المدينة طويل جدًا."),
    foundedYear: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(toWesternDigits(v))))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 1300 && v <= 1500), "أدخل سنة التأسيس الهجرية، مثل ١٤٣٥.")
      .nullable()
      .default(null),
    contactPhone: requiredPhone,
    contactEmail: optionalEmail,
    website: optionalUrl,
    programNumbers: z
      .array(z.coerce.number().int().min(1).max(99))
      .min(1, "اختاروا برنامجًا واحدًا على الأقل من برامج الرئاسة.")
      .transform((v) => [...new Set(v)].sort((a, b) => a - b)),
    officerName: fullNameSchema,
    officerNationalId: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : toWesternDigits(v)))
      .refine((v) => v === null || /^[12][0-9]{9}$/.test(v), "رقم الهوية الوطنية أو الإقامة عشرة أرقام ويبدأ بالرقم ١ أو ٢.")
      .nullable()
      .default(null),
    officerPhone: requiredPhone,
    officerEmail: optionalEmail,
    username: usernameSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
    pledge: z.literal("on", { error: "يلزم التعهد بالالتزام بقيم الرئاسة وصحة البيانات." }),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "كلمتا المرور غير متطابقتين." });

export type RegistrationInput = z.infer<typeof registrationSchema>;

/** Which step of the journey each field belongs to, so the form opens the step of the first error. */
export const REGISTRATION_FIELD_STEP: Record<string, number> = {
  name: 1,
  licenseNumber: 1,
  classification: 1,
  region: 1,
  city: 1,
  foundedYear: 1,
  contactPhone: 1,
  contactEmail: 1,
  website: 1,
  programNumbers: 2,
  officerName: 3,
  officerNationalId: 3,
  officerPhone: 3,
  officerEmail: 3,
  username: 3,
  password: 3,
  confirmPassword: 3,
  pledge: 4,
};

export const registrationLookupSchema = z.object({
  referenceNo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^JM-[A-Z0-9]{8}$/, "رقم الطلب يبدأ بـ JM- ويتبعه ثمانية رموز."),
  licenseNumber: z.string().trim().transform(toWesternDigits).pipe(z.string().min(1, "أدخل رقم الترخيص.")),
});

export const registrationDecisionSchema = z.object({
  note: z.string().trim().max(1000, "الملاحظة طويلة جدًا.").default(""),
});
