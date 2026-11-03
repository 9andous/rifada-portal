"use server";

import { revalidatePath } from "next/cache";
import { DECISIONS, type Decision } from "@/lib/requests";
import { draftFromForm } from "@/lib/validation/requests";
import { reassignRequests } from "@/server/services/requests/assignment";
import { addAttachmentVersion, attachOwnFile, attachRequirementFile, removeDraftAttachment } from "@/server/services/requests/attachments";
import { addComment } from "@/server/services/requests/comments";
import { decideRequests } from "@/server/services/requests/decisions";
import { createDraft, discardDraft, saveDraft } from "@/server/services/requests/drafts";
import {
  approveRequests,
  changeRequestScope,
  editEvaluation,
  evaluateRequest,
  type ApprovalInput,
  type EvaluationEditInput,
  type EvaluationInput,
} from "@/server/services/requests/review";
import { submitRequest } from "@/server/services/requests/submit";
import { asAdmin as asUser, fromRefusal } from "./admin/guard";
import { INVALID_MESSAGE } from "./admin/state";
import type { RequestFormState } from "./requests-state";

// Thin wrappers over the request services (Phase 3). Each one runs as the signed-in user; the
// services check permissions, scope and status on the server and audit every change.

const ID = /^[a-z0-9]{8,40}$/;
const UPLOAD_ID = /^[a-f0-9]{32}$/;
const MAX_IDS = 100;

function refresh() {
  // Request data appears on lists, detail pages and dashboards of every role.
  revalidatePath("/", "layout");
}

const str = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

function ids(values: readonly unknown[]): string[] | null {
  const list = values.filter((v): v is string => typeof v === "string");
  if (list.length !== values.length || list.length > MAX_IDS || !list.every((v) => ID.test(v))) return null;
  return list;
}

export async function createDraftAction(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    const trackId = str(formData, "trackId");
    const requestTypeId = str(formData, "requestTypeId");
    const title = str(formData, "title");
    if (!ID.test(trackId)) return { ok: false, errors: { trackId: "اختاروا المسار المستهدف." } };
    if (!ID.test(requestTypeId)) return { ok: false, errors: { requestTypeId: "اختاروا نوع الطلب." } };
    const r = await createDraft(user, { trackId, requestTypeId, title });
    if (!r.ok) return fromRefusal(r);
    refresh();
    return { ok: true, createdId: r.id };
  });
}

/**
 * A new request's first «التالي» (D-123): creates the draft in the chosen track and type, then
 * saves what was typed. Field errors come back as for a save.
 */
export async function createDraftFromFormAction(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    const trackId = str(formData, "trackId");
    const requestTypeId = str(formData, "requestTypeId");
    const errors: Record<string, string> = {};
    if (!ID.test(trackId)) errors.trackId = "اختاروا المسار المستهدف.";
    if (!ID.test(requestTypeId)) errors.requestTypeId = "اختاروا نوع الطلب.";
    if (Object.keys(errors).length) return { ok: false, errors };
    const created = await createDraft(user, { trackId, requestTypeId, title: str(formData, "title") });
    if (!created.ok) return fromRefusal(created);
    const saved = await saveDraft(user, created.id, draftFromForm(formData));
    refresh();
    // The draft exists even if a value was refused; the form keeps its id and shows the error.
    return saved.ok ? { ok: true, createdId: created.id } : { ...fromRefusal(saved), createdId: created.id };
  });
}

export async function saveDraftAction(id: string, _prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    if (!ID.test(id)) return { ok: false, message: INVALID_MESSAGE };
    const r = await saveDraft(user, id, draftFromForm(formData));
    if (!r.ok) return { ...fromRefusal(r), message: r.message ?? INVALID_MESSAGE };
    refresh();
    return { ok: true, message: "حُفظت البيانات." };
  });
}

/** Saves the form, then submits: the completeness check decides. */
export async function submitRequestAction(id: string, _prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    if (!ID.test(id)) return { ok: false, message: INVALID_MESSAGE };
    const saved = await saveDraft(user, id, draftFromForm(formData));
    if (!saved.ok) return { ...fromRefusal(saved), message: saved.message ?? INVALID_MESSAGE };
    const r = await submitRequest(user, id);
    refresh();
    if (!r.ok) return { ok: false, message: r.message, missing: r.missing };
    return { ok: true, referenceNo: r.referenceNo, message: "قُدِّم الطلب بنجاح." };
  });
}

export async function discardDraftAction(id: string): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    if (!ID.test(id)) return { ok: false, message: INVALID_MESSAGE };
    const r = await discardDraft(user, id);
    if (!r.ok) return fromRefusal(r);
    refresh();
    return { ok: true };
  });
}

export async function attachFileAction(requestId: string, requirementKey: string, uploadId: string): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    if (!ID.test(requestId) || !/^[a-z][a-z0-9_]{1,39}$/.test(requirementKey) || !UPLOAD_ID.test(uploadId)) return { ok: false, message: INVALID_MESSAGE };
    const r = await attachRequirementFile(user, requestId, requirementKey, uploadId);
    if (!r.ok) return { ok: false, message: r.message ?? r.errors?.file };
    refresh();
    return { ok: true };
  });
}

export async function attachOwnFileAction(requestId: string, uploadId: string): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    if (!ID.test(requestId) || !UPLOAD_ID.test(uploadId)) return { ok: false, message: INVALID_MESSAGE };
    const r = await attachOwnFile(user, requestId, uploadId);
    if (!r.ok) return { ok: false, message: r.message ?? r.errors?.file };
    refresh();
    return { ok: true };
  });
}

export async function addVersionAction(requestId: string, attachmentId: string, uploadId: string): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    if (!ID.test(requestId) || !ID.test(attachmentId) || !UPLOAD_ID.test(uploadId)) return { ok: false, message: INVALID_MESSAGE };
    const r = await addAttachmentVersion(user, requestId, attachmentId, uploadId);
    if (!r.ok) return { ok: false, message: r.message ?? r.errors?.file };
    refresh();
    return { ok: true };
  });
}

export async function removeFileAction(requestId: string, attachmentId: string): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    if (!ID.test(requestId) || !ID.test(attachmentId)) return { ok: false, message: INVALID_MESSAGE };
    const r = await removeDraftAttachment(user, requestId, attachmentId);
    if (!r.ok) return fromRefusal(r);
    refresh();
    return { ok: true };
  });
}

/** One decision for one or many requests, with one shared reason (change 16, 18). */
export async function decideAction(requestIds: string[], decision: Decision, reason: string): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    const list = ids(requestIds);
    if (!list || !DECISIONS.includes(decision) || typeof reason !== "string") return { ok: false, message: INVALID_MESSAGE };
    const r = await decideRequests(user, list, decision, reason);
    if (!r.ok) return fromRefusal(r);
    refresh();
    return { ok: true, outcome: r.outcome };
  });
}

/** «تقييم واعتماد» by the assigned supervisor: criteria, note, password; sealed by the server (D-116, D-122). */
export async function evaluateAction(requestId: string, input: EvaluationInput): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    if (!ID.test(requestId) || typeof input !== "object" || input === null) return { ok: false, message: INVALID_MESSAGE };
    const r = await evaluateRequest(user, requestId, input);
    if (!r.ok) return fromRefusal(r);
    refresh();
    return { ok: true };
  });
}

/** The unit manager's signed final approval, for one request or a bulk selection (D-117). */
export async function approveAction(requestIds: string[], input: ApprovalInput): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    const list = ids(requestIds);
    if (!list || typeof input !== "object" || input === null) return { ok: false, message: INVALID_MESSAGE };
    const r = await approveRequests(user, list, input);
    if (!r.ok) return fromRefusal(r);
    refresh();
    return { ok: true, outcome: r.outcome };
  });
}

/** The unit manager changes the supervisor's evaluation before deciding (D-120). */
export async function editEvaluationAction(requestId: string, input: EvaluationEditInput): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    if (!ID.test(requestId) || typeof input !== "object" || input === null) return { ok: false, message: INVALID_MESSAGE };
    const r = await editEvaluation(user, requestId, input);
    if (!r.ok) return fromRefusal(r);
    refresh();
    return { ok: true };
  });
}

/** The programme and initiatives of a request under review (D-116). */
export async function changeScopeAction(requestId: string, programId: string, initiativeIds: string[], note: string): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    const list = Array.isArray(initiativeIds) ? ids(initiativeIds) : null;
    if (!ID.test(requestId) || !ID.test(programId) || !list || typeof note !== "string") return { ok: false, message: INVALID_MESSAGE };
    const r = await changeRequestScope(user, requestId, { programId, initiativeIds: list, note });
    if (!r.ok) return fromRefusal(r);
    refresh();
    return { ok: true };
  });
}

export async function reassignAction(requestIds: string[], toUserId: string, reason: string): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    const list = ids(requestIds);
    if (!list || !ID.test(toUserId) || typeof reason !== "string") return { ok: false, message: INVALID_MESSAGE };
    const r = await reassignRequests(user, list, toUserId, reason);
    if (!r.ok) return fromRefusal(r);
    refresh();
    return { ok: true, outcome: r.outcome };
  });
}

export async function addCommentAction(requestId: string, _prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  return asUser<RequestFormState>(async (user) => {
    if (!ID.test(requestId)) return { ok: false, message: INVALID_MESSAGE };
    const parentId = str(formData, "parentId");
    const uploadIds = formData.getAll("uploadId").filter((v): v is string => typeof v === "string" && v !== "");
    if ((parentId && !ID.test(parentId)) || !uploadIds.every((u) => UPLOAD_ID.test(u))) return { ok: false, message: INVALID_MESSAGE };
    const r = await addComment(user, requestId, {
      body: str(formData, "body"),
      internal: formData.get("internal") === "on",
      parentId: parentId || null,
      uploadIds,
    });
    if (!r.ok) return fromRefusal(r);
    refresh();
    return { ok: true, createdId: r.id };
  });
}
