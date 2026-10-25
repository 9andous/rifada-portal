"use server";

import { revalidatePath } from "next/cache";
import { countUnit, formatNumber } from "@/lib/format";
import { fieldErrors } from "@/lib/validation/auth";
import {
  attachmentRequirementCreateSchema,
  fieldRequirementCreateSchema,
  fieldRequirementUpdateSchema,
  requirementFromForm,
} from "@/lib/validation/taxonomy";
import { ForbiddenError } from "@/server/authz/scope";
import { requireUser } from "@/server/auth/session";
import {
  copyRequirements,
  createAttachmentRequirement,
  createFieldRequirement,
  moveRequirement,
  previewCopy,
  removeRequirement,
  updateAttachmentRequirement,
  updateFieldRequirement,
  type CopyPreviewItem,
  type CopyTarget,
} from "@/server/services/admin/requirements";
import { asAdmin, fromRefusal } from "./guard";
import { FORBIDDEN_MESSAGE, INVALID_MESSAGE, type AdminFormState } from "./state";

const INITIATIVE_UNIT = { one: "مبادرة", two: "مبادرتين", few: "مبادرات", many: "مبادرة" };

function refresh() {
  revalidatePath("/admin/taxonomy", "layout");
  revalidatePath("/manager/taxonomy", "layout");
}

export async function createFieldRequirementAction(initiativeId: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = fieldRequirementCreateSchema.safeParse(requirementFromForm(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await createFieldRequirement(user, initiativeId, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "أُضيف الحقل." };
  });
}

/** The key is not read from the form: it is immutable after creation (D-051). */
export async function updateFieldRequirementAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = fieldRequirementUpdateSchema.safeParse(requirementFromForm(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await updateFieldRequirement(user, id, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "حُفظ الحقل." };
  });
}

export async function createAttachmentRequirementAction(initiativeId: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = attachmentRequirementCreateSchema.safeParse(requirementFromForm(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await createAttachmentRequirement(user, initiativeId, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "أُضيف المرفق المطلوب." };
  });
}

export async function updateAttachmentRequirementAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await updateAttachmentRequirement(user, id, formData.get("isRequired") === "on");
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "حُفظ المرفق المطلوب." };
  });
}

export async function removeRequirementAction(id: string): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await removeRequirement(user, id);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true, message: "حُذف المتطلب من هذه المبادرة." };
  });
}

export async function moveRequirementAction(id: string, direction: "up" | "down"): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await moveRequirement(user, id, direction);
    if (!result.ok) return fromRefusal(result);
    refresh();
    return { ok: true };
  });
}

export type CopyPreviewState = { ok: boolean; message?: string; items?: CopyPreviewItem[]; sourceCount?: number };

export async function previewCopyAction(sourceId: string, target: CopyTarget): Promise<CopyPreviewState> {
  const user = await requireUser();
  try {
    const result = await previewCopy(user, sourceId, target);
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, items: result.items, sourceCount: result.sourceCount };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, message: FORBIDDEN_MESSAGE };
    throw error;
  }
}

export async function copyRequirementsAction(sourceId: string, target: CopyTarget): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await copyRequirements(user, sourceId, target);
    if (!result.ok) return fromRefusal(result);
    refresh();
    const n = result.targets;
    const count = n === 1 ? "مبادرة واحدة" : n === 2 ? "مبادرتين" : `${formatNumber(n)} ${countUnit(n, INITIATIVE_UNIT)}`;
    return { ok: true, message: `نُسخت المتطلبات إلى ${count}.` };
  });
}
