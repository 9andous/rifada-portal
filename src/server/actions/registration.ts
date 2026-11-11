"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { formObject } from "@/lib/validation/admin";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import {
  COMPLETION_ARRAY_FIELDS,
  completionSchema,
  inviteHoursSchema,
  inviteSchema,
  registrationDecisionSchema,
  registrationLookupSchema,
  registrationStepSchema,
} from "@/lib/validation/registration";
import { clientIp } from "@/server/http/client-ip";
import { rateLimit } from "@/server/services/rate-limit";
import {
  approveRegistration,
  cancelInvitation,
  createInvitation,
  getInvitation,
  lookupRegistration,
  rejectRegistration,
  renewInvitation,
  submitCompletion,
  type RegistrationLookup,
} from "@/server/services/registrations";
import { asAdmin, fromRefusal } from "./admin/guard";
import type { AdminFormState } from "./admin/state";

export type RegistrationFormState = { ok?: boolean; message?: string; errors?: FieldErrors; referenceNo?: string };
export type StepCheck = { ok: boolean; errors?: FieldErrors };
export type LookupState = { ok?: boolean; message?: string; errors?: FieldErrors; result?: RegistrationLookup };
/** The created link's token and expiry, for the confirmation panel. */
export type InviteFormState = AdminFormState & { invite?: { token: string; expiresAt: string } };

const TOO_MANY = "تجاوزتم عدد المحاولات المسموح بها. حاولوا بعد قليل.";
const LINK_UNUSABLE = "رابط التسجيل غير صالح أو انتهت صلاحيته. تواصلوا مع الوحدة الإشرافية لإصدار رابط جديد.";
const UPLOAD_ID = /^[a-f0-9]{32}$/;

async function clientKey(): Promise<string> {
  return clientIp(await headers());
}

// ---------------------------------------------------------------------------
// The association, through its link (public)
// ---------------------------------------------------------------------------

/** Checks one step of the association's form before the next opens. The link must still be open. */
export async function checkRegistrationStepAction(token: string, step: number, formData: FormData): Promise<StepCheck> {
  if (!rateLimit(`registration-step:${await clientKey()}`, 60, 15 * 60 * 1000)) return { ok: false, errors: { form: TOO_MANY } };
  if ((await getInvitation(token)).state !== "open") return { ok: false, errors: { form: LINK_UNUSABLE } };
  if (!Number.isInteger(step) || step < 1 || step > 3) return { ok: true };
  const parsed = registrationStepSchema(step).safeParse(formObject(formData, COMPLETION_ARRAY_FIELDS));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  return { ok: true };
}

/** Sends the association's part. Limited to five submissions per hour per client. */
export async function submitRegistrationAction(token: string, _: RegistrationFormState, formData: FormData): Promise<RegistrationFormState> {
  const raw = formObject(formData, COMPLETION_ARRAY_FIELDS);
  // Honeypot: the field is hidden from people; a filled value means an automated submission.
  if (typeof raw.website_confirm === "string" && raw.website_confirm !== "") return { ok: false, message: "تعذّر إرسال الطلب." };
  if (!rateLimit(`registration:${await clientKey()}`, 5, 60 * 60 * 1000)) return { ok: false, message: TOO_MANY };

  const parsed = completionSchema.safeParse(raw);
  const letter = String(formData.get("letter.uploadId") ?? "");
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    if (!UPLOAD_ID.test(letter)) errors.letter = "أرفقوا الخطاب بصيغة PDF.";
    return { ok: false, message: "راجعوا الحقول المشار إليها ثم أعيدوا الإرسال.", errors };
  }
  const logo = String(formData.get("image.uploadId") ?? "");
  const result = await submitCompletion(token, parsed.data, {
    letterUploadId: UPLOAD_ID.test(letter) ? letter : null,
    logoUploadId: UPLOAD_ID.test(logo) ? logo : null,
  });
  if (!result.ok) return { ok: false, message: result.message ?? "راجعوا الحقول المشار إليها ثم أعيدوا الإرسال.", errors: result.errors };
  revalidatePath("/admin/registrations");
  return { ok: true, referenceNo: result.referenceNo };
}

/** Public: the status of an application by reference and licence number. Limited per client. */
export async function lookupRegistrationAction(_: LookupState, formData: FormData): Promise<LookupState> {
  if (!rateLimit(`registration-lookup:${await clientKey()}`, 20, 15 * 60 * 1000)) return { ok: false, message: TOO_MANY };
  const parsed = registrationLookupSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const result = await lookupRegistration(parsed.data.referenceNo, parsed.data.licenseNumber);
  if (!result) return { ok: false, message: "لم نعثر على طلب بهذا الرقم ورقم الترخيص. تأكدوا من البيانات." };
  return { ok: true, result };
}

// ---------------------------------------------------------------------------
// The super admin
// ---------------------------------------------------------------------------

export async function createInvitationAction(_: InviteFormState, formData: FormData): Promise<InviteFormState> {
  return asAdmin<InviteFormState>(async (user) => {
    const parsed = inviteSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, message: "لم تُحفظ البيانات؛ صحّح الحقول المشار إليها.", errors: fieldErrors(parsed.error) };
    const result = await createInvitation(user, parsed.data);
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/registrations");
    return { ok: true, createdId: result.id, invite: { token: result.token, expiresAt: result.expiresAt.toISOString() } };
  });
}

export async function renewInvitationAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = inviteHoursSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    const result = await renewInvitation(user, id, parsed.data.hours);
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/registrations");
    revalidatePath(`/admin/registrations/${id}`);
    return { ok: true };
  });
}

export async function cancelInvitationAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = registrationDecisionSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    const result = await cancelInvitation(user, id, parsed.data.note);
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/registrations");
    revalidatePath(`/admin/registrations/${id}`);
    return { ok: true };
  });
}

export async function approveRegistrationAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = registrationDecisionSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    const result = await approveRegistration(user, id, parsed.data.note);
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/registrations");
    revalidatePath("/admin/associations");
    return { ok: true, createdId: result.associationId, credentials: result.credentials };
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
