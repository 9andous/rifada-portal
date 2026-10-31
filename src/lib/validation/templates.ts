import * as z from "zod";

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

/** «الأدلة والنماذج» (D-113): a guide is read for reference, a form is filled in and attached. */
export const TEMPLATE_KINDS = ["GUIDE", "FORM"] as const;
export type TemplateKindKey = (typeof TEMPLATE_KINDS)[number];
export const TEMPLATE_KIND_LABEL: Record<TemplateKindKey, string> = { GUIDE: "دليل", FORM: "نموذج" };

/** Template metadata. The file arrives separately as a staged upload id. */
export const templateMetaSchema = z.object({
  kind: z.enum(TEMPLATE_KINDS, "اختر نوع الملف: دليل أو نموذج."),
  title: z.string().trim().min(3, "أدخل عنوان النموذج.").max(200, "العنوان طويل جدًا."),
  description: z
    .string()
    .trim()
    .max(2000, "الوصف طويل جدًا.")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null),
  programId: optionalId,
  initiativeId: optionalId,
  attachmentTypeId: optionalId,
});
export type TemplateMetaInput = z.infer<typeof templateMetaSchema>;

export function templateMetaFromForm(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "");
  return { kind: str("kind"), title: str("title"), description: str("description"), programId: str("programId"), initiativeId: str("initiativeId"), attachmentTypeId: str("attachmentTypeId") };
}

export const UPLOAD_ID_PATTERN = /^[a-f0-9]{32}$/;
