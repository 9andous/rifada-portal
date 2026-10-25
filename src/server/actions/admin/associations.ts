"use server";

import { revalidatePath } from "next/cache";
import { associationFormSchema, formObject, officerFormSchema } from "@/lib/validation/admin";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import { createAssociation, createAssociationOfficer, setAssociationActive, updateAssociation } from "@/server/services/admin/associations";
import { asAdmin, fromRefusal } from "./guard";
import { INVALID_MESSAGE, type AdminFormState } from "./state";

const OFFICER_PREFIX = "officer.";

function officerFields(raw: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([k]) => k.startsWith(OFFICER_PREFIX))
      .map(([k, v]) => [k.slice(OFFICER_PREFIX.length), v]),
  );
}

export async function createAssociationAction(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const raw = formObject(formData);
    const association = associationFormSchema.safeParse(raw);
    const withOfficer = raw.createOfficer === "on";
    const officer = withOfficer ? officerFormSchema.safeParse(officerFields(raw)) : null;

    const errors: FieldErrors = association.success ? {} : fieldErrors(association.error);
    if (officer && !officer.success) {
      for (const [k, v] of Object.entries(fieldErrors(officer.error))) errors[`${OFFICER_PREFIX}${k}`] = v;
    }
    if (!association.success || (officer && !officer.success)) return { ok: false, message: INVALID_MESSAGE, errors };

    const result = await createAssociation(user, association.data, officer?.success ? officer.data : null);
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/associations");
    return { ok: true, createdId: result.associationId, credentials: result.officer ?? undefined };
  });
}

/** «إنشاء حساب مسؤول» on the page of an association that has no officer account yet. */
export async function createAssociationOfficerAction(associationId: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = officerFormSchema.safeParse(officerFields(formObject(formData)));
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const [k, v] of Object.entries(fieldErrors(parsed.error))) errors[`${OFFICER_PREFIX}${k}`] = v;
      return { ok: false, message: INVALID_MESSAGE, errors };
    }
    const result = await createAssociationOfficer(user, associationId, parsed.data);
    if (!result.ok) return fromRefusal(result);
    revalidatePath(`/admin/associations/${associationId}`);
    revalidatePath("/admin/associations");
    revalidatePath("/admin/users");
    return { ok: true, createdId: result.userId, credentials: { username: result.username, password: result.password } };
  });
}

export async function updateAssociationAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = associationFormSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await updateAssociation(user, id, parsed.data);
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/associations");
    revalidatePath(`/admin/associations/${id}`);
    return { ok: true, message: "حُفظت التغييرات." };
  });
}

export async function setAssociationActiveAction(id: string, active: boolean): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await setAssociationActive(user, id, active);
    if (!result.ok) return fromRefusal(result);
    revalidatePath("/admin/associations");
    revalidatePath(`/admin/associations/${id}`);
    revalidatePath("/admin/users");
    const message = active
      ? "فُعّلت الجمعية. إن كان لها حساب مسؤول معطل فيبقى كذلك حتى تفعّله من صفحة المستخدم."
      : result.officerDeactivated
        ? "عُطّلت الجمعية، وعُطّل حساب مسؤولها وأُنهيت جلساته."
        : "عُطّلت الجمعية.";
    return { ok: true, message };
  });
}
