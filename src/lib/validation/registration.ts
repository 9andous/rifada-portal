// Validation for the public association registration (D-094). Shared by the server action, the
// service and the tests.

import * as z from "zod";
import { citiesOf } from "../saudi-cities";
import { fullNameSchema, requiredEmail, requiredPhone, toWesternDigits, usernameSchema } from "./admin";
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


const optionalUrl = z
  .string()
  .trim()
  .max(200, "الرابط طويل جدًا.")
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "أدخل رابطًا يبدأ بـ https://")
  .nullable()
  .default(null);

const registrationFields = z.object({
  name: z.string().trim().min(3, "أدخل اسم الجمعية كما في الترخيص.").max(150, "اسم الجمعية طويل جدًا."),
  licenseNumber: z
    .string()
    .trim()
    .transform(toWesternDigits)
    .pipe(z.string().regex(/^[0-9]{1,10}$/, "رقم الترخيص أرقام فقط، كما في شهادة تسجيل المركز الوطني لتنمية القطاع غير الربحي.")),
  classification: z.enum(REGISTRATION_CLASSIFICATIONS, { error: "اختر تصنيف الجمعية." }),
  region: z.enum(SAUDI_REGIONS, { error: "اختر المنطقة." }),
  city: z.string().trim().min(1, "اختر المدينة."),
  foundedYear: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(toWesternDigits(v))))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1300 && v <= 1500), "أدخل سنة التأسيس الهجرية، مثل ١٤٣٥.")
    .nullable()
    .default(null),
  contactPhone: requiredPhone,
  contactEmail: requiredEmail,
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
  officerEmail: requiredEmail,
  username: usernameSchema,
  password: newPasswordSchema,
  confirmPassword: z.string(),
  pledge: z.literal("on", { error: "يلزم التعهد بالالتزام بقيم الرئاسة وصحة البيانات." }),
});

const passwordsMatch = { path: ["confirmPassword"], message: "كلمتا المرور غير متطابقتين." };

/** The city must be one of the chosen region's cities (the form offers them as a dropdown). */
const cityInRegion = { path: ["city"], message: "اختر مدينة من مدن المنطقة المختارة." };

export const registrationSchema = registrationFields
  .refine((v) => citiesOf(v.region).includes(v.city), cityInRegion)
  .refine((v) => v.password === v.confirmPassword, passwordsMatch);

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

type RegistrationField = keyof typeof registrationFields.shape;

/** The fields entered on one step of the journey. */
export function registrationStepFields(step: number): RegistrationField[] {
  return (Object.keys(REGISTRATION_FIELD_STEP) as RegistrationField[]).filter((k) => REGISTRATION_FIELD_STEP[k] === step);
}

/** Validation of one step's fields, so each «التالي» checks that step before moving on. */
export function registrationStepSchema(step: number) {
  const keys = registrationStepFields(step);
  const picked = registrationFields.pick(Object.fromEntries(keys.map((k) => [k, true])) as Partial<Record<RegistrationField, true>>);
  if (keys.includes("confirmPassword")) {
    return picked.refine((v) => (v as { password?: string }).password === (v as { confirmPassword?: string }).confirmPassword, passwordsMatch);
  }
  if (keys.includes("city")) {
    return picked.refine((v) => {
      const { region, city } = v as { region?: string; city?: string };
      return citiesOf(region ?? "").includes(city ?? "");
    }, cityInRegion);
  }
  return picked;
}

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
