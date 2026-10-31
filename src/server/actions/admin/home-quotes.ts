"use server";

import { revalidatePath } from "next/cache";
import { fieldErrors } from "@/lib/validation/auth";
import { heroQuoteStyleSchema, homeQuoteFromForm, homeQuoteSchema } from "@/lib/validation/home-quotes";
import { createHomeQuote, deleteHomeQuote, moveHomeQuote, setHeroQuoteStyle, updateHomeQuote } from "@/server/services/admin/home-quotes";
import { imageChangeFrom } from "@/server/services/images";
import { asAdmin, fromRefusal } from "./guard";
import { INVALID_MESSAGE, type AdminFormState } from "./state";

function refresh() {
  revalidatePath("/admin/settings/home");
  revalidatePath("/");
}

export async function createHomeQuoteAction(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = homeQuoteSchema.safeParse(homeQuoteFromForm(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await createHomeQuote(user, parsed.data, imageChangeFrom(formData));
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "أُضيفت الكلمة إلى الصفحة الرئيسية.", createdId: result.id };
  });
}

export async function updateHomeQuoteAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = homeQuoteSchema.safeParse(homeQuoteFromForm(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await updateHomeQuote(user, id, parsed.data, imageChangeFrom(formData));
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "حُفظت التغييرات." };
  });
}

export async function deleteHomeQuoteAction(id: string): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await deleteHomeQuote(user, id);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "حُذفت الكلمة." };
  });
}

export async function moveHomeQuoteAction(id: string, direction: "up" | "down"): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await moveHomeQuote(user, id, direction === "up" ? "up" : "down");
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true };
  });
}

export async function setHeroQuoteStyleAction(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = heroQuoteStyleSchema.safeParse(formData.get("style"));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? INVALID_MESSAGE };
    const result = await setHeroQuoteStyle(user, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "حُفظ شكل الكلمات." };
  });
}
