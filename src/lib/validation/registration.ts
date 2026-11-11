// Validation for association registration by invitation (D-149): the super admin's part, then the
// association's part through its link. Shared by the server actions, the services and the tests.

import * as z from "zod";
import { SERVICE_SITE_KEYS, placeKeysOf, type ServiceSite } from "../service-places";
import { fullNameSchema, requiredEmail, requiredPhone, toWesternDigits } from "./admin";

/** Classifications of the supervision initiative (initiative document, page 3), plus «أخرى». */
export const REGISTRATION_CLASSIFICATIONS = [
  "منظمات خدمة ضيوف الرحمن",
  "منظمات الدعوة والإرشاد والتعليم الديني",
  "البحوث العلمية والمطبوعات والترجمة بالحرمين الشريفين",
  "أخرى",
] as const;

export const OTHER_CLASSIFICATION = "أخرى";

/** The letter («الخطاب»): a PDF of at most this size. */
export const LETTER_MAX_MB = 10;

const optionalUrl = z
  .string()
  .trim()
  .max(200, "الرابط طويل جدًا.")
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "أدخل رابطًا يبدأ بـ https://")
  .nullable()
  .default(null);

const optionalPhone = z
  .string()
  .trim()
  .transform((v) => toWesternDigits(v).replace(/[\s-]/g, ""))
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^(\+?966|0)?5[0-9]{8}$/.test(v), "أدخل رقم جوال سعوديًا صحيحًا، مثل ٠٥٠١٢٣٤٥٦٧.")
  .nullable()
  .default(null);

export const licenseNumberSchema = z
  .string()
  .trim()
  .transform(toWesternDigits)
  .pipe(z.string().regex(/^[0-9]{1,10}$/, "رقم الترخيص أرقام فقط، كما في شهادة تسجيل المركز الوطني لتنمية القطاع غير الربحي."));

/** What the super admin enters when adding an association. The creation date is set by the system. */
export const inviteSchema = z.object({
  name: z.string().trim().min(3, "أدخل اسم الجمعية كما في الترخيص.").max(150, "اسم الجمعية طويل جدًا."),
  officerName: fullNameSchema,
  secondOfficerName: fullNameSchema,
  website: optionalUrl,
  contactEmail: requiredEmail,
  licenseNumber: licenseNumberSchema,
});

export type InviteInput = z.infer<typeof inviteSchema>;

const completionFields = z.object({
  classification: z.enum(REGISTRATION_CLASSIFICATIONS, { error: "اختر تصنيف الجمعية." }),
  /** The association's own classification when it chooses «أخرى». */
  classificationOther: z.string().trim().max(150, "التصنيف طويل جدًا.").default(""),
  foundedYear: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(toWesternDigits(v))))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1300 && v <= 1500), "أدخل سنة التأسيس الهجرية، مثل ١٤٣٥.")
    .nullable()
    .default(null),
  contactPhone: requiredPhone,
  /** Used only when the super admin left the website empty. */
  website: optionalUrl,
  serviceSite: z.enum(SERVICE_SITE_KEYS as [ServiceSite, ...ServiceSite[]], { error: "اختر مكان تقديم الخدمة: مكة المكرمة أو المدينة المنورة." }),
  servicePlaces: z.array(z.string()).default([]),
  officerPhone: requiredPhone,
  secondOfficerPhone: optionalPhone,
  pledge: z.literal("on", { error: "يلزم التعهد بالالتزام بقيم الرئاسة وصحة البيانات." }),
});

/** «أخرى» needs the association to name its classification. */
const otherNamed = (v: { classification?: string; classificationOther?: string }, ctx: z.RefinementCtx) => {
  if (v.classification === OTHER_CLASSIFICATION && (v.classificationOther ?? "").length < 3) {
    ctx.addIssue({ code: "custom", path: ["classificationOther"], message: "اكتبوا تصنيف الجمعية." });
  }
};

/** The places must belong to the chosen site, and at least one is chosen. */
const placesInSite = (v: { serviceSite?: string; servicePlaces?: string[] }, ctx: z.RefinementCtx) => {
  const site = v.serviceSite as ServiceSite | undefined;
  if (!site || !SERVICE_SITE_KEYS.includes(site)) return;
  const places = v.servicePlaces ?? [];
  const allowed = placeKeysOf(site);
  if (places.length === 0) ctx.addIssue({ code: "custom", path: ["servicePlaces"], message: "اختر مكانًا واحدًا على الأقل من أماكن تقديم الخدمة." });
  else if (places.some((p) => !allowed.includes(p))) ctx.addIssue({ code: "custom", path: ["servicePlaces"], message: "اختر الأماكن من أماكن الموقع المختار." });
};

export const completionSchema = completionFields.superRefine(placesInSite).superRefine(otherNamed).transform(({ classificationOther, ...v }) => ({
  ...v,
  // «أخرى» is stored as the classification the association wrote.
  classification: v.classification === OTHER_CLASSIFICATION ? classificationOther : v.classification,
  // Stored in the site's order, without repeats.
  servicePlaces: placeKeysOf(v.serviceSite).filter((k) => v.servicePlaces.includes(k)),
}));

export type CompletionInput = z.infer<typeof completionSchema>;

/** Fields of the completion form that arrive repeated. */
export const COMPLETION_ARRAY_FIELDS = ["servicePlaces"] as const;

/** Which step of the association's form each field belongs to, so the form opens the step of the first error. */
export const REGISTRATION_FIELD_STEP: Record<string, number> = {
  classification: 1,
  classificationOther: 1,
  foundedYear: 1,
  contactPhone: 1,
  website: 1,
  image: 1,
  serviceSite: 2,
  servicePlaces: 2,
  officerPhone: 3,
  secondOfficerPhone: 3,
  letter: 4,
  pledge: 4,
};

type CompletionField = keyof typeof completionFields.shape;

/** The schema fields entered on one step of the form. */
export function registrationStepFields(step: number): CompletionField[] {
  return (Object.keys(completionFields.shape) as CompletionField[]).filter((k) => REGISTRATION_FIELD_STEP[k] === step);
}

/** Validation of one step's fields, so each «التالي» checks that step before moving on. */
export function registrationStepSchema(step: number) {
  const keys = registrationStepFields(step);
  const picked = completionFields.pick(Object.fromEntries(keys.map((k) => [k, true])) as Partial<Record<CompletionField, true>>);
  if (keys.includes("serviceSite")) return picked.superRefine(placesInSite);
  if (keys.includes("classification")) return picked.superRefine(otherNamed);
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

/** The new validity of a link, in hours from now (the settings' limits). */
export const inviteHoursSchema = z.object({
  hours: z.coerce
    .number({ error: "أدخل عدد الساعات رقمًا صحيحًا." })
    .int("أدخل عدد الساعات رقمًا صحيحًا.")
    .min(1, "يجب ألا تقل المدة عن ساعة.")
    .max(720, "يجب ألا تزيد المدة على ٧٢٠ ساعة (ثلاثين يومًا)."),
});
