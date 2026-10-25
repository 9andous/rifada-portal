"use server";

import { revalidatePath } from "next/cache";
import { settingsFromForm } from "@/lib/validation/settings";
import { updateSettings } from "@/server/services/admin/settings";
import { asAdmin, fromRefusal } from "./guard";
import type { AdminFormState } from "./state";

export async function updateSettingsAction(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await updateSettings(user, settingsFromForm(formData));
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/settings");
    return {
      ok: true,
      message: result.changed.length === 0 ? "لا توجد تغييرات للحفظ." : "حُفظت الإعدادات وسُجّل التغيير في سجل التدقيق.",
    };
  });
}
