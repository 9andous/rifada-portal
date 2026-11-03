"use server";

import { revalidatePath } from "next/cache";
import { fieldErrors } from "@/lib/validation/auth";
import { associationProfileFromForm, associationProfileSchema } from "@/lib/validation/association-profile";
import { updateOwnAssociationProfile } from "@/server/services/association-profile";
import { imageChangeFrom } from "@/server/services/images";
import { asAdmin, fromRefusal } from "./admin/guard";
import { INVALID_MESSAGE, type AdminFormState } from "./admin/state";

/** «ملف الجمعية»: the officer saves the association's contact details and logo (D-101). */
export async function updateAssociationProfileAction(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = associationProfileSchema.safeParse(associationProfileFromForm(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await updateOwnAssociationProfile(user, parsed.data, imageChangeFrom(formData));
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/association", "layout");
    return { ok: true, message: "حُفظت بيانات التواصل." };
  });
}
