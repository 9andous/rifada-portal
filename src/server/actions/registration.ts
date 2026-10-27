"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { formObject } from "@/lib/validation/admin";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import { registrationDecisionSchema, registrationLookupSchema, registrationSchema, registrationStepSchema } from "@/lib/validation/registration";
import { rateLimit } from "@/server/services/rate-limit";
import {
  approveRegistration,
  checkRegistrationAvailability,
  lookupRegistration,
  rejectRegistration,
  submitRegistration,
  type RegistrationLookup,
} from "@/server/services/registrations";
import { asAdmin, fromRefusal } from "./admin/guard";
import type { AdminFormState } from "./admin/state";

export type RegistrationFormState = { ok?: boolean; message?: string; errors?: FieldErrors; referenceNo?: string };
export type StepCheck = { ok: boolean; errors?: FieldErrors };
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

/**
 * Public: checks one step of the journey before the next opens: the step's fields against the
 * submission's rules, then whether its license, username, email or ID is already in use.
 * Limited per client, since it answers whether a license or username is registered.
 */
export async function checkRegistrationStepAction(step: number, formData: FormData): Promise<StepCheck> {
  if (!Number.isInteger(step) || step < 1 || step > 3) return { ok: true };
  if (!rateLimit(`registration-step:${await clientKey()}`, 60, 15 * 60 * 1000)) return { ok: false, errors: { form: TOO_MANY } };
  const parsed = registrationStepSchema(step).safeParse(formObject(formData, ["programNumbers"]));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const v = parsed.data as { licenseNumber?: string; username?: string; officerEmail?: string | null; officerNationalId?: string | null };
  const free = await checkRegistrationAvailability({ licenseNumber: v.licenseNumber, username: v.username, email: v.officerEmail, nationalId: v.officerNationalId });
  if (!free.ok) return { ok: false, errors: free.errors ?? { form: free.message ?? "تعذّر التحقق من البيانات." } };
  return { ok: true };
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
