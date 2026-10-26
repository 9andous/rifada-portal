"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { formObject } from "@/lib/validation/admin";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import { registrationDecisionSchema, registrationLookupSchema, registrationSchema } from "@/lib/validation/registration";
import { rateLimit } from "@/server/services/rate-limit";
import { approveRegistration, lookupRegistration, rejectRegistration, submitRegistration, type RegistrationLookup } from "@/server/services/registrations";
import { asAdmin, fromRefusal } from "./admin/guard";
import type { AdminFormState } from "./admin/state";

export type RegistrationFormState = { ok?: boolean; message?: string; errors?: FieldErrors; referenceNo?: string };
export type LookupState = { ok?: boolean; message?: string; errors?: FieldErrors; result?: RegistrationLookup };

const TOO_MANY = "تجاوزتم عدد المحاولات المسموح بها. حاولوا بعد قليل.";

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Public: submits an association's application. Limited to five submissions per hour per client. */
export async function submitRegistrationAction(_: RegistrationFormState, formData: FormData): Promise<RegistrationFormState> {
  const raw = formObject(formData, ["programNumbers"]);
  // Honeypot: the field is hidden from people; a filled value means an automated submission.
  if (typeof raw.website_confirm === "string" && raw.website_confirm !== "") return { ok: false, message: "تعذّر إرسال الطلب." };
  if (!rateLimit(`registration:${await clientKey()}`, 5, 60 * 60 * 1000)) return { ok: false, message: TOO_MANY };

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "راجعوا الحقول المشار إليها ثم أعيدوا الإرسال.", errors: fieldErrors(parsed.error) };
  const result = await submitRegistration(parsed.data);
  if (!result.ok) return { ok: false, message: result.message ?? "راجعوا الحقول المشار إليها ثم أعيدوا الإرسال.", errors: result.errors };
  revalidatePath("/admin/registrations");
  return { ok: true, referenceNo: result.referenceNo };
}

/** Public: the status of an application by reference and license number. Limited per client. */
export async function lookupRegistrationAction(_: LookupState, formData: FormData): Promise<LookupState> {
  if (!rateLimit(`registration-lookup:${await clientKey()}`, 20, 15 * 60 * 1000)) return { ok: false, message: TOO_MANY };
  const parsed = registrationLookupSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const result = await lookupRegistration(parsed.data.referenceNo, parsed.data.licenseNumber);
  if (!result) return { ok: false, message: "لم نعثر على طلب بهذا الرقم ورقم الترخيص. تأكدوا من البيانات." };
  return { ok: true, result };
}

export async function approveRegistrationAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = registrationDecisionSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    const result = await approveRegistration(user, id, parsed.data.note);
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/registrations");
    revalidatePath(`/admin/registrations/${id}`);
    revalidatePath("/admin/associations");
    return { ok: true, createdId: result.associationId };
  });
}

export async function rejectRegistrationAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = registrationDecisionSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    const result = await rejectRegistration(user, id, parsed.data.note);
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/registrations");
    revalidatePath(`/admin/registrations/${id}`);
    return { ok: true };
  });
}
