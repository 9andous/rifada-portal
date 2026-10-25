import * as z from "zod";
import { arabicList, ltr } from "../format";

/** Upload groups the super admin can allow. Video is not a group and can never be allowed. */
export const UPLOAD_GROUPS = ["pdf", "word", "excel", "image"] as const;
export type UploadGroup = (typeof UPLOAD_GROUPS)[number];

const IMAGE_FORMATS = `(${arabicList(["PNG", "JPEG", "WebP"].map(ltr))})`;

// Every Latin term is isolated with ltr() and lists use arabicList(); scripts/check-ui-rules.mjs
// refuses an Arabic letter written directly against a Latin one.
export const UPLOAD_GROUP_LABELS: Record<UploadGroup, string> = {
  pdf: `ملفات ${ltr("PDF")}`,
  word: `مستندات ${ltr("Word (docx)")}`,
  excel: `جداول ${ltr("Excel (xlsx)")}`,
  image: `الصور ${IMAGE_FORMATS}`,
};

/** «PDF، Word (docx)، Excel (xlsx)، الصور (PNG، JPEG، WebP)» for help texts and refusals. */
export const ALLOWED_FILE_TYPES_TEXT = arabicList([ltr("PDF"), ltr("Word (docx)"), ltr("Excel (xlsx)"), `الصور ${IMAGE_FORMATS}`]);

export const SETTING_LIMITS = {
  sla: { min: 1, max: 60 },
  uploadMb: { min: 1, max: 100 },
  bulk: { min: 1, max: 100 },
  quotaMb: { min: 100, max: 51200 },
} as const;

const intIn = (min: number, max: number, label: string) =>
  z.coerce
    .number({ error: `أدخل ${label} رقمًا صحيحًا.` })
    .int(`أدخل ${label} رقمًا صحيحًا.`)
    .min(min, `يجب ألا يقل ${label} عن ${min}.`)
    .max(max, `يجب ألا يزيد ${label} على ${max}.`);

/** The settings the super admin edits on /admin/settings. `demo.enabled` is managed by the demo loader. */
export const settingsSchema = z.object({
  "sla.workingDays": intIn(SETTING_LIMITS.sla.min, SETTING_LIMITS.sla.max, "عدد أيام العمل"),
  "uploads.maxFileMb": intIn(SETTING_LIMITS.uploadMb.min, SETTING_LIMITS.uploadMb.max, "الحد الأقصى لحجم الملف"),
  "uploads.allowedGroups": z
    .array(z.enum(UPLOAD_GROUPS, { error: "نوع ملف غير مسموح به." }))
    .min(1, "اختر نوعًا واحدًا على الأقل من أنواع المرفقات.")
    .transform((groups) => UPLOAD_GROUPS.filter((g) => groups.includes(g))),
  "uploads.associationQuotaMb": intIn(SETTING_LIMITS.quotaMb.min, SETTING_LIMITS.quotaMb.max, "حد التخزين لكل جمعية"),
  "bulk.maxItems": intIn(SETTING_LIMITS.bulk.min, SETTING_LIMITS.bulk.max, "الحد الأقصى للإجراء الجماعي"),
  "public.showInitiatives": z.boolean({ error: "قيمة غير صالحة." }),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
export type EditableSettingKey = keyof SettingsInput;
export const EDITABLE_SETTING_KEYS = Object.keys(settingsSchema.shape) as EditableSettingKey[];

/** Reads the settings form (checkboxes arrive as repeated or missing fields). */
export function settingsFromForm(formData: FormData): Record<string, unknown> {
  return {
    "sla.workingDays": formData.get("sla.workingDays"),
    "uploads.maxFileMb": formData.get("uploads.maxFileMb"),
    "uploads.allowedGroups": formData.getAll("uploads.allowedGroups").map(String),
    "uploads.associationQuotaMb": formData.get("uploads.associationQuotaMb"),
    "bulk.maxItems": formData.get("bulk.maxItems"),
    "public.showInitiatives": formData.get("public.showInitiatives") === "on",
  };
}
