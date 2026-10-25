"use server";

import { revalidatePath } from "next/cache";
import { fieldErrors } from "@/lib/validation/auth";
import { templateMetaFromForm, templateMetaSchema, UPLOAD_ID_PATTERN } from "@/lib/validation/templates";
import { createTemplate, replaceTemplateFile, setTemplateArchived, setTemplatePublished, updateTemplate } from "@/server/services/admin/templates";
import { asAdmin, fromRefusal } from "./guard";
import { INVALID_MESSAGE, type AdminFormState } from "./state";

// Thin wrappers over services/admin/templates.ts (content.manage, audit). Files arrive beforehand
// through POST /api/admin/template-uploads; these actions receive only the staged upload id.

const NEED_FILE = "اختر ملف النموذج وانتظر اكتمال رفعه.";

function refresh() {
  revalidatePath("/admin/taxonomy/templates", "layout");
  revalidatePath("/association/documents");
  revalidatePath("/supervisor/templates");
  revalidatePath("/manager/taxonomy/templates");
}

export async function createTemplateAction(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = templateMetaSchema.safeParse(templateMetaFromForm(formData));
    const uploadId = String(formData.get("uploadId") ?? "");
    const errors = parsed.success ? {} : fieldErrors(parsed.error);
    if (!UPLOAD_ID_PATTERN.test(uploadId)) errors.file = NEED_FILE;
    if (!parsed.success || errors.file) return { ok: false, message: INVALID_MESSAGE, errors };
    const result = await createTemplate(user, parsed.data, uploadId);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "أُضيف النموذج غير منشور. انشره ليظهر للجمعيات والفريق.", createdId: result.id };
  });
}

export async function updateTemplateAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = templateMetaSchema.safeParse(templateMetaFromForm(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await updateTemplate(user, id, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "حُفظت بيانات النموذج." };
  });
}

export async function replaceTemplateFileAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const uploadId = String(formData.get("uploadId") ?? "");
    if (!UPLOAD_ID_PATTERN.test(uploadId)) return { ok: false, errors: { file: NEED_FILE } };
    const result = await replaceTemplateFile(user, id, uploadId);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "استُبدل الملف، وبقي الملف السابق محفوظًا في سجل الإصدارات." };
  });
}

export async function setTemplatePublishedAction(id: string, published: boolean): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await setTemplatePublished(user, id, published);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: published ? "نُشر النموذج." : "أُلغي نشر النموذج." };
  });
}

export async function setTemplateArchivedAction(id: string, archived: boolean): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await setTemplateArchived(user, id, archived);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: archived ? "أُرشف النموذج وأُلغي نشره." : "استُعيد النموذج غير منشور." };
  });
}
