// Fixtures for the Phase 3 request tests: the seeded lifecycle, a small taxonomy with requirements,
// two associations, supervisors on both programs, and helpers that drive the real services.

import { Readable } from "node:stream";
import { seedStatuses } from "../../prisma/seed/statuses";
import { REVIEW_CRITERIA } from "@/config/review-criteria";
import type { Actor } from "@/server/authz/scope";
import { addAttachmentVersion, attachOwnFile, uploadContext } from "@/server/services/requests/attachments";
import { createDraft, saveDraft } from "@/server/services/requests/drafts";
import { approveRequests, evaluateRequest, type EvaluationInput } from "@/server/services/requests/review";
import { submitRequest } from "@/server/services/requests/submit";
import { stageUpload } from "@/server/uploads/stage";
import { actorOf, makeAssociation, makeRequestTypes, makeRoleActors, makeUser, TEST_PASSWORD } from "./admin";
import { db } from "./db";
import { FIXTURES } from "./files";
import { makeTaxonomy } from "./taxonomy";

export const MIME = {
  pdf: "application/pdf",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** A start date far enough ahead to pass the «today or later» rule. */
export const FUTURE = { start: "2099-01-10", end: "2099-02-20" };

export async function makeRequestWorld() {
  await seedStatuses(db);
  const tax = await makeTaxonomy();
  const ctx = await makeRoleActors();
  const [t1, t2] = ctx.tracks;
  const requestTypes = await makeRequestTypes();
  const [p1, p2] = tax.programs;
  const [i1, i2] = tax.initiatives; // both in program 1
  const iP2 = tax.initiatives.find((i) => i.programId === p2.id)!;
  const type = (key: string) => tax.types.find((t) => t.key === key)!;

  await db.initiativeRequirement.createMany({
    data: [
      { initiativeId: i1.id, kind: "FIELD", key: "participants", label: "عدد المشاركين", fieldType: "NUMBER", isRequired: true, sortOrder: 1 },
      { initiativeId: i1.id, kind: "FIELD", key: "level", label: "المستوى", fieldType: "SELECT", options: ["مبتدئ", "متقدم"], isRequired: true, sortOrder: 2 },
      { initiativeId: i1.id, kind: "FIELD", key: "notes", label: "ملاحظات", fieldType: "TEXTAREA", isRequired: false, sortOrder: 3 },
      { initiativeId: i1.id, kind: "FIELD", key: "session_date", label: "تاريخ الجلسة الأولى", fieldType: "DATE", isRequired: false, sortOrder: 4 },
      { initiativeId: i1.id, kind: "ATTACHMENT", key: "program_plan", label: "خطة البرنامج", attachmentTypeId: type("program_plan").id, isRequired: true, sortOrder: 1 },
      { initiativeId: i1.id, kind: "ATTACHMENT", key: "supporting_documents", label: "مستندات داعمة", attachmentTypeId: type("supporting_documents").id, isRequired: false, sortOrder: 2 },
    ],
  });

  // makeRoleActors' supervisor is on track 1 (programme p1). Add a second supervisor on track 1 and one on track 2.
  const supervisor2 = await makeUser("SUPERVISOR", { username: "zz.supervisor", trackIds: [t1.id] });
  const supervisorP2 = await makeUser("SUPERVISOR", { trackIds: [t2.id] });
  const association2 = await makeAssociation("جمعية أخرى");
  const officer2 = await makeUser("ASSOCIATION_OFFICER", { associationId: association2.id });
  const manager2 = await makeUser("UNIT_MANAGER");

  return {
    ...ctx,
    tax,
    t1,
    t2,
    requestTypes,
    p1,
    p2,
    i1,
    i2,
    iP2,
    users: { ...ctx.users, supervisor2, supervisorP2, officer2, manager2 },
    actors: {
      ...ctx.actors,
      admin: ctx.actors.SUPER_ADMIN,
      manager: ctx.actors.UNIT_MANAGER,
      supervisor: ctx.actors.SUPERVISOR,
      officer: ctx.actors.ASSOCIATION_OFFICER,
      supervisor2: actorOf(supervisor2, [t1.id]),
      supervisorP2: actorOf(supervisorP2, [t2.id]),
      officer2: actorOf(officer2),
      manager2: actorOf(manager2),
    },
  };
}

export type RequestWorld = Awaited<ReturnType<typeof makeRequestWorld>>;

export async function stageFor(actor: Actor, requestId: string | null, fileName = "خطة.pdf", bytes: Buffer = FIXTURES.pdf(), mime = MIME.pdf) {
  const r = await stageUpload({
    uploaderId: actor.id,
    sessionId: null,
    fileName,
    declaredMime: mime,
    contentLength: bytes.length,
    body: Readable.from([bytes]),
    context: requestId ? uploadContext(requestId) : null,
  });
  if (!r.ok) throw new Error(r.message);
  return r.uploadId;
}

export const validDraft = (overrides: Record<string, unknown> = {}) => ({
  title: "دورة تأهيل المؤذنين",
  description: "برنامج تدريبي لتأهيل المؤذنين الجدد.",
  goals: "تأهيل المؤذنين الجدد على الأداء الصحيح للأذان.",
  expectedBeneficiaries: "المؤذنون الجدد\nطلاب العلم",
  startDate: FUTURE.start,
  endDate: FUTURE.end,
  estimatedBudget: "٤٨٠٬٠٠٠",
  kpis: "عدد المتدربين، نسبة الحضور",
  partners: "",
  ...overrides,
});

/** A draft in a track (D-123): track 1 by default, whose supervisors are `supervisor` and `supervisor2`. */
export async function newDraft(w: RequestWorld, actor: Actor = w.actors.officer, track: { id: string } = w.t1) {
  const r = await createDraft(actor, { trackId: track.id, requestTypeId: w.requestTypes[0].id, title: "دورة تأهيل المؤذنين" });
  if (!r.ok) throw new Error(r.message ?? JSON.stringify(r.errors));
  return r.id;
}

/** The association's plan as one of its own files (D-123: no initiative requirements). */
export async function attachPlan(actor: Actor, requestId: string, revision?: string) {
  const r = await attachOwnFile(actor, requestId, await stageFor(actor, requestId, "خطة.pdf", FIXTURES.pdf(revision)));
  if (!r.ok) throw new Error(r.message ?? JSON.stringify(r.errors));
  return r.attachmentId;
}

export async function addVersion(actor: Actor, requestId: string, attachmentId: string, revision: string) {
  return addAttachmentVersion(actor, requestId, attachmentId, await stageFor(actor, requestId, "خطة معدلة.pdf", FIXTURES.pdf(revision)));
}

/** A complete draft of `actor`, submitted. Returns the id and reference number. */
export async function submittedRequest(w: RequestWorld, actor: Actor = w.actors.officer, track: { id: string } = w.t1) {
  const id = await newDraft(w, actor, track);
  const saved = await saveDraft(actor, id, validDraft());
  if (!saved.ok) throw new Error(JSON.stringify(saved));
  await attachPlan(actor, id);
  const result = await submitRequest(actor, id);
  if (!result.ok) throw new Error(`${result.message} ${JSON.stringify("missing" in result ? result.missing : [])}`);
  return { id, referenceNo: result.referenceNo };
}

/** A complete «تقييم واعتماد» input; `met` marks every criterion. */
export function evaluationInput(overrides: Partial<EvaluationInput> = {}, met = true): EvaluationInput {
  return { criteria: REVIEW_CRITERIA.map((c) => ({ key: c.key, met, note: "" })), note: "", password: TEST_PASSWORD, ...overrides };
}

/** The unit manager's password confirming the final approval (D-117); the server seals it (D-122). */
export const managerSignature = () => ({ password: TEST_PASSWORD });

/** The assigned supervisor evaluates and signs, then the unit manager approves (D-116). */
export async function evaluateAndApprove(w: RequestWorld, id: string, supervisor: Actor = w.actors.supervisor) {
  const evaluated = await evaluateRequest(supervisor, id, evaluationInput());
  if (!evaluated.ok) throw new Error(evaluated.message ?? JSON.stringify(evaluated.errors));
  const approved = await approveRequests(w.actors.manager, [id], managerSignature());
  if (!approved.ok || approved.outcome.done.length !== 1) throw new Error(JSON.stringify(approved));
}
