"use server";

import { revalidatePath } from "next/cache";
import { formObject, userFormSchema } from "@/lib/validation/admin";
import { fieldErrors } from "@/lib/validation/auth";
import { createUser, resetUserPassword, setUserActive, updateUser } from "@/server/services/admin/users";
import { asAdmin, fromRefusal } from "./guard";
import { INVALID_MESSAGE, type AdminFormState } from "./state";

function parseUserForm(formData: FormData) {
  return userFormSchema.safeParse(formObject(formData, ["programIds"]));
}

export async function createUserAction(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = parseUserForm(formData);
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await createUser(user, parsed.data);
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/users");
    return { ok: true, createdId: result.userId, credentials: { username: result.username, password: result.password } };
  });
}

export async function updateUserAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = parseUserForm(formData);
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await updateUser(user, id, parsed.data);
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${id}`);
    return { ok: true, message: "حُفظت التغييرات." };
  });
}

export async function setUserActiveAction(id: string, active: boolean): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await setUserActive(user, id, active);
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${id}`);
    return {
      ok: true,
      message: active ? "فُعّل الحساب." : "عُطّل الحساب وأُنهيت جميع جلساته.",
    };
  });
}

export async function resetUserPasswordAction(id: string): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await resetUserPassword(user, id);
    if (!result.ok) return fromRefusal(result);
    revalidatePath(`/admin/users/${id}`);
    return { ok: true, credentials: { username: result.username, password: result.password } };
  });
}
