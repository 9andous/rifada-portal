"use server";

import { revalidatePath } from "next/cache";
import { fieldErrors } from "@/lib/validation/auth";
import { attachmentTypeCreateSchema, attachmentTypeFromForm, attachmentTypeUpdateSchema } from "@/lib/validation/taxonomy";
import { createAttachmentType, setAttachmentTypeArchived, updateAttachmentType } from "@/server/services/admin/attachment-types";
import { asAdmin, fromRefusal } from "./guard";
import { INVALID_MESSAGE, type AdminFormState } from "./state";

function refresh() {
  revalidatePath("/admin/taxonomy", "layout");
}

export async function createAttachmentTypeAction(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = attachmentTypeCreateSchema.safeParse(attachmentTypeFromForm(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await createAttachmentType(user, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "أُضيف نوع المرفق.", createdId: result.id };
  });
}

/** The key is not read from the form: it is immutable after creation. */
export async function updateAttachmentTypeAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = attachmentTypeUpdateSchema.safeParse(attachmentTypeFromForm(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await updateAttachmentType(user, id, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "حُفظت التغييرات." };
  });
}

export async function setAttachmentTypeArchivedAction(id: string, archived: boolean): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await setAttachmentTypeArchived(user, id, archived);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: archived ? "أُرشف نوع المرفق؛ يبقى في المتطلبات الحالية ولا يُعرض للمتطلبات الجديدة." : "استُعيد نوع المرفق." };
  });
}
