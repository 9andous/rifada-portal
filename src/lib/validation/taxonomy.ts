// Validation for the taxonomy, attachment-type and requirement editors (Phase 2b stop 1).

import * as z from "zod";
import { toWesternDigits } from "./admin";
import { UPLOAD_GROUPS } from "./settings";

const text = (min: number, max: number, empty: string, long: string) => z.string().trim().min(min, empty).max(max, long);

const optionalLong = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} طويل جدًا.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

/** Whole number from a form field; Arabic-Indic digits are accepted. */
const intIn = (min: number, max: number, message: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? toWesternDigits(v.trim()) : v),
    z.coerce.number({ error: message }).int(message).min(min, message).max(max, message),
  );

export const programFormSchema = z.object({
  number: intIn(1, 99, "أدخل رقم البرنامج عددًا صحيحًا من ١ إلى ٩٩."),
  name: text(3, 200, "أدخل اسم البرنامج.", "اسم البرنامج طويل جدًا."),
  officialName: optionalLong(300, "الاسم الرسمي"),
  description: optionalLong(4000, "الوصف"),
  sortOrder: intIn(0, 999, "أدخل ترتيب العرض عددًا صحيحًا من ٠ إلى ٩٩٩."),
});
export type ProgramFormInput = z.infer<typeof programFormSchema>;

export const goalFormSchema = z.object({ text: text(3, 1000, "أدخل نص الهدف.", "نص الهدف طويل جدًا.") });
export type GoalFormInput = z.infer<typeof goalFormSchema>;

export const initiativeFormSchema = z.object({
  number: intIn(1, 999, "أدخل رقم المبادرة عددًا صحيحًا من ١ إلى ٩٩٩."),
  name: text(3, 300, "أدخل اسم المبادرة.", "اسم المبادرة طويل جدًا."),
  description: optionalLong(4000, "الوصف"),
  sourceNote: optionalLong(2000, "ملاحظة المصدر"),
});
export type InitiativeFormInput = z.infer<typeof initiativeFormSchema>;

export const objectiveFormSchema = z.object({
  title: text(3, 500, "أدخل عنوان الهدف الإستراتيجي.", "العنوان طويل جدًا."),
  description: optionalLong(4000, "الوصف"),
});
export type ObjectiveFormInput = z.infer<typeof objectiveFormSchema>;

/** Keys are Latin, lower case, start with a letter; they become stable identifiers and never change. */
export const KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
const keySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(KEY_PATTERN, "يتكون المفتاح من أحرف لاتينية صغيرة وأرقام والشرطة السفلية _، ويبدأ بحرف، من ٢ إلى ٤٠ حرفًا.");

const groupsSchema = z
  .array(z.enum(UPLOAD_GROUPS, { error: "نوع ملف غير مسموح به. لا يُسمح بملفات الفيديو." }))
  .min(1, "اختر نوعًا واحدًا على الأقل من أنواع الملفات.")
  .transform((groups) => UPLOAD_GROUPS.filter((g) => groups.includes(g)));

export const attachmentTypeCreateSchema = z.object({
  key: keySchema,
  name: text(2, 150, "أدخل اسم نوع المرفق.", "الاسم طويل جدًا."),
  groups: groupsSchema,
});
/** Updates never carry the key: it is immutable after creation. */
export const attachmentTypeUpdateSchema = attachmentTypeCreateSchema.omit({ key: true });
export type AttachmentTypeCreateInput = z.infer<typeof attachmentTypeCreateSchema>;
export type AttachmentTypeUpdateInput = z.infer<typeof attachmentTypeUpdateSchema>;

/** The general request fields every request has; they are fixed and cannot be redefined per initiative. */
export const GENERAL_REQUEST_FIELDS = [
  { key: "title", label: "عنوان الطلب" },
  { key: "description", label: "الوصف" },
  { key: "targetAudience", label: "الفئة المستهدفة" },
  { key: "location", label: "مكان التنفيذ" },
  { key: "startDate", label: "تاريخ البداية" },
  { key: "endDate", label: "تاريخ النهاية" },
] as const;
const RESERVED_KEYS = new Set(GENERAL_REQUEST_FIELDS.map((f) => f.key.toLowerCase()));

export const FIELD_TYPES = ["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT"] as const;
export type FieldTypeValue = (typeof FIELD_TYPES)[number];
export const FIELD_TYPE_LABELS: Record<FieldTypeValue, string> = {
  TEXT: "نص قصير",
  TEXTAREA: "نص طويل",
  NUMBER: "رقم",
  DATE: "تاريخ",
  SELECT: "قائمة اختيار",
};

export const MAX_SELECT_OPTIONS = 30;

const fieldBase = z.object({
  label: text(2, 150, "أدخل عنوان الحقل كما يظهر للجمعية.", "عنوان الحقل طويل جدًا."),
  fieldType: z.enum(FIELD_TYPES, { error: "اختر نوع الحقل." }),
  /** One option per line in the form. */
  options: z.array(z.string()).default([]),
  isRequired: z.boolean().default(true),
});

function refineOptions<T extends { fieldType: FieldTypeValue; options: string[] }>(v: T, ctx: z.RefinementCtx) {
  if (v.fieldType !== "SELECT") return;
  // Blank lines (e.g. a trailing newline in the textarea) are ignored, not errors.
  const options = v.options.map((o) => o.trim()).filter((o) => o !== "");
  if (options.length === 0) ctx.addIssue({ code: "custom", path: ["options"], message: "أضف خيارًا واحدًا على الأقل لقائمة الاختيار." });
  if (options.length > MAX_SELECT_OPTIONS) ctx.addIssue({ code: "custom", path: ["options"], message: `الحد الأقصى ${MAX_SELECT_OPTIONS} خيارًا.` });
  if (new Set(options).size !== options.length) ctx.addIssue({ code: "custom", path: ["options"], message: "الخيارات مكررة؛ اجعل كل خيار مختلفًا." });
  if (options.some((o) => o.length > 150)) ctx.addIssue({ code: "custom", path: ["options"], message: "أحد الخيارات طويل جدًا." });
}

/** Options are kept only for SELECT fields and stored trimmed. */
const normaliseOptions = <T extends { fieldType: FieldTypeValue; options: string[] }>(v: T) => ({
  ...v,
  options: v.fieldType === "SELECT" ? v.options.map((o) => o.trim()).filter((o) => o !== "") : [],
});

export const fieldRequirementCreateSchema = fieldBase
  .extend({
    key: keySchema.refine((k) => !RESERVED_KEYS.has(k.toLowerCase()), "هذا المفتاح محجوز لأحد حقول الطلب العامة."),
  })
  .superRefine(refineOptions)
  .transform(normaliseOptions);

/** Updates never carry the key (immutable after creation, D-051). */
export const fieldRequirementUpdateSchema = fieldBase.superRefine(refineOptions).transform(normaliseOptions);

export type FieldRequirementCreateInput = z.infer<typeof fieldRequirementCreateSchema>;
export type FieldRequirementUpdateInput = z.infer<typeof fieldRequirementUpdateSchema>;

export const attachmentRequirementCreateSchema = z.object({
  attachmentTypeId: z.string().trim().min(1, "اختر نوع المرفق."),
  isRequired: z.boolean().default(true),
});
export const attachmentRequirementUpdateSchema = z.object({ isRequired: z.boolean() });
export type AttachmentRequirementCreateInput = z.infer<typeof attachmentRequirementCreateSchema>;

/** Reads the requirement form: options as one per line, checkbox as on/absent. */
export function requirementFromForm(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "");
  return {
    key: str("key"),
    label: str("label"),
    fieldType: str("fieldType"),
    options: str("options").split(/\r?\n/),
    isRequired: formData.get("isRequired") === "on",
    attachmentTypeId: str("attachmentTypeId"),
  };
}

export function attachmentTypeFromForm(formData: FormData) {
  return {
    key: String(formData.get("key") ?? ""),
    name: String(formData.get("name") ?? ""),
    groups: formData.getAll("groups").map(String),
  };
}
