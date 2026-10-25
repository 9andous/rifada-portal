"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { fieldErrors } from "@/lib/validation/auth";
import { STATUS_TONES, TRANSITION_ROLES } from "@/lib/workflow";
import { createTransition, moveStatus, removeTransition, updateStatus, updateTransition } from "@/server/services/admin/statuses";
import { asAdmin, fromRefusal } from "./guard";
import { INVALID_MESSAGE, type AdminFormState } from "./state";

// Thin wrappers over services/admin/statuses.ts (settings.manage, lifecycle validation, audit).

const statusSchema = z.object({
  name: z.string().trim().min(2, "أدخل اسم الحالة.").max(60, "الاسم طويل جدًا."),
  tone: z.enum(STATUS_TONES, { error: "اختر لونًا من القائمة." }),
});

const rolesSchema = z.array(z.enum(TRANSITION_ROLES, { error: "دور غير صالح لانتقال الطلبات." }));

function transitionFields(formData: FormData) {
  return { roles: formData.getAll("roles").map(String), isAutomatic: formData.get("isAutomatic") === "on" };
}

function refresh() {
  revalidatePath("/admin/settings", "layout");
  revalidatePath("/manager/taxonomy/lifecycle");
}

export async function updateStatusAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = statusSchema.safeParse({ name: formData.get("name"), tone: formData.get("tone") });
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await updateStatus(user, id, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "حُفظت الحالة." };
  });
}

export async function moveStatusAction(id: string, direction: "up" | "down"): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await moveStatus(user, id, direction);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true };
  });
}

export async function createTransitionAction(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const { roles, isAutomatic } = transitionFields(formData);
    const parsed = z
      .object({ fromStatusId: z.string().min(1, "اختر الحالة الأولى."), toStatusId: z.string().min(1, "اختر الحالة التالية."), roles: rolesSchema })
      .safeParse({ fromStatusId: String(formData.get("fromStatusId") ?? ""), toStatusId: String(formData.get("toStatusId") ?? ""), roles });
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await createTransition(user, { ...parsed.data, isAutomatic });
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "أُضيف الانتقال." };
  });
}

export async function updateTransitionAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const { roles, isAutomatic } = transitionFields(formData);
    const parsed = rolesSchema.safeParse(roles);
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: { roles: parsed.error.issues[0]?.message } };
    const result = await updateTransition(user, id, { roles: parsed.data, isAutomatic });
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "حُفظ الانتقال." };
  });
}

export async function removeTransitionAction(id: string): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await removeTransition(user, id);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "حُذف الانتقال." };
  });
}
