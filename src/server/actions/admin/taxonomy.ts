"use server";

import { revalidatePath } from "next/cache";
import { fieldErrors } from "@/lib/validation/auth";
import { formObject } from "@/lib/validation/admin";
import { goalFormSchema, initiativeFormSchema, objectiveFormSchema, programFormSchema } from "@/lib/validation/taxonomy";
import {
  createGoal,
  createInitiative,
  createProgram,
  moveGoal,
  setGoalArchived,
  setInitiativeActive,
  setInitiativeArchived,
  setInitiativeObjectives,
  setProgramActive,
  setProgramArchived,
  updateGoal,
  updateInitiative,
  updateObjective,
  updateProgram,
} from "@/server/services/admin/taxonomy-editor";
import { asAdmin, fromRefusal } from "./guard";
import { INVALID_MESSAGE, type AdminFormState } from "./state";

// Thin wrappers over services/admin/taxonomy-editor.ts, which enforce taxonomy.manage and audit.

const SAVED = "حُفظت التغييرات.";

function refreshTaxonomy() {
  revalidatePath("/admin/taxonomy", "layout");
  revalidatePath("/manager/taxonomy", "layout");
}

export async function createProgramAction(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = programFormSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await createProgram(user, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: "أُضيف البرنامج.", createdId: String(result.number) };
  });
}

export async function updateProgramAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = programFormSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await updateProgram(user, id, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: SAVED, createdId: String(result.number) };
  });
}

export async function setProgramActiveAction(id: string, active: boolean): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await setProgramActive(user, id, active);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: active ? "أُعيد تشغيل البرنامج." : "أُوقف البرنامج؛ لن تظهر مبادراته في نموذج الطلب حتى يُعاد تشغيله." };
  });
}

export async function setProgramArchivedAction(id: string, archived: boolean): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await setProgramArchived(user, id, archived);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: archived ? "أُرشف البرنامج." : "استُعيد البرنامج." };
  });
}

export async function createGoalAction(programId: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = goalFormSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await createGoal(user, programId, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: "أُضيف الهدف." };
  });
}

export async function updateGoalAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = goalFormSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await updateGoal(user, id, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: SAVED };
  });
}

export async function setGoalArchivedAction(id: string, archived: boolean): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await setGoalArchived(user, id, archived);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: archived ? "أُرشف الهدف." : "استُعيد الهدف." };
  });
}

export async function moveGoalAction(id: string, direction: "up" | "down"): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await moveGoal(user, id, direction);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true };
  });
}

export async function createInitiativeAction(programId: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = initiativeFormSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await createInitiative(user, programId, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: "أُضيفت المبادرة.", createdId: result.id };
  });
}

export async function updateInitiativeAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = initiativeFormSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await updateInitiative(user, id, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: SAVED };
  });
}

export async function setInitiativeActiveAction(id: string, active: boolean): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await setInitiativeActive(user, id, active);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: active ? "أُعيد تشغيل المبادرة." : "أُوقفت المبادرة؛ لا تُقبل عليها طلبات جديدة." };
  });
}

export async function setInitiativeArchivedAction(id: string, archived: boolean): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const result = await setInitiativeArchived(user, id, archived);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: archived ? "أُرشفت المبادرة." : "استُعيدت المبادرة." };
  });
}

export async function setInitiativeObjectivesAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const numbers = formData
      .getAll("objectives")
      .map((v) => Number.parseInt(String(v), 10))
      .filter((n) => Number.isInteger(n));
    const result = await setInitiativeObjectives(user, id, numbers);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: "حُفظ ارتباط المبادرة بالأهداف الإستراتيجية." };
  });
}

export async function updateObjectiveAction(id: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return asAdmin(async (user) => {
    const parsed = objectiveFormSchema.safeParse(formObject(formData));
    if (!parsed.success) return { ok: false, message: INVALID_MESSAGE, errors: fieldErrors(parsed.error) };
    const result = await updateObjective(user, id, parsed.data);
    if (!result.ok) return fromRefusal(result);
    refreshTaxonomy();
    return { ok: true, message: SAVED };
  });
}
