import * as z from "zod";

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

/** Template metadata. The file arrives separately as a staged upload id. */
export const templateMetaSchema = z.object({
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
  return { title: str("title"), description: str("description"), programId: str("programId"), initiativeId: str("initiativeId"), attachmentTypeId: str("attachmentTypeId") };
}

export const UPLOAD_ID_PATTERN = /^[a-f0-9]{32}$/;
