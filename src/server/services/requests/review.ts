import "server-only";
import * as z from "zod";
import { REVIEW_CRITERIA, type CriterionResult } from "@/config/review-criteria";
import { toArabicDigits } from "@/lib/format";
import { can } from "@/server/authz/permissions";
import { scopeRequests, type Actor } from "@/server/authz/scope";
import { verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { createSeal } from "@/server/seal/seal";
import { assertCan, fieldRefusal, refuse, type Result } from "@/server/services/admin/common";
import { audit } from "@/server/services/audit";
import { notify } from "@/server/services/notifications";
import { availableInitiativeWhere } from "@/server/services/taxonomy";
import { decideRequests } from "./decisions";
import { activeManagerIds, requestRef, statusMap, type Tx } from "./common";

// The two-step review (D-116). The assigned supervisor evaluates the request against the acceptance
// criteria, notes, signs (password re-entered, sealed electronically, D-122) and sends it to the unit manager,
// who approves, returns or rejects it (decisions.ts). While it is under review the supervisor (at
// the supervisor stage) and the unit manager may change its programme and initiatives, never its
// content. The request stays «قيد المراجعة» throughout, so the association sees no step in between.

const MSG = {
  unavailable: "الطلب غير متاح لك.",
  notUnderReview: "الطلب ليس قيد المراجعة.",
  notYours: "لا يقيّم الطلب إلا المشرف المسند إليه.",
  wrongStage: "أُرسل الطلب إلى مدير الوحدة؛ لا يمكن تقييمه مرة أخرى قبل أن يعود.",
  password: "كلمة المرور غير صحيحة.",
  scopeNotAllowed: "لا يمكنك تعديل البرنامج والمبادرات في هذا الطلب الآن.",
  programUnavailable: "البرنامج المختار غير متاح.",
  programOutsideTrack: "البرنامج المختار لا يتبع مسار الطلب.",
  initiativesMissing: "اختر مبادرة واحدة على الأقل.",
  initiativesUnavailable: "بعض المبادرات المختارة غير متاحة أو لا تتبع البرنامج المختار.",
  unchanged: "لم يتغير البرنامج ولا المبادرات.",
  changed: "تغيّر الطلب قبل تنفيذ الإجراء؛ حدّث الصفحة.",
} as const;

const NOTE_MAX = 1000;

const note = z
  .string()
  .trim()
  .max(NOTE_MAX, `الملاحظة طويلة جدًا (الحد ${toArabicDigits(NOTE_MAX)} حرف).`)
  .transform((v) => (v === "" ? null : v));

// Signing is confirmed with the password; the seal itself is made by the server (D-122).
const signerFields = {
  password: z.string().min(1, "أدخل كلمة المرور لتأكيد التوقيع.").max(200),
};

const criteriaFields = {
  criteria: z
    .array(z.object({ key: z.enum(REVIEW_CRITERIA.map((c) => c.key) as [string, ...string[]]), met: z.boolean(), note }))
    .refine((list) => REVIEW_CRITERIA.every((c) => list.filter((r) => r.key === c.key).length === 1), "حدّد لكل معيار: مستوفى أو غير مستوفى."),
  note,
};

export const evaluationSchema = z.object({
  ...criteriaFields,
  ...signerFields,
});

export type EvaluationInput = z.input<typeof evaluationSchema>;

async function passwordMatches(userId: string, password: string): Promise<boolean> {
  const account = await db.account.findFirst({ where: { userId, providerId: "credential" }, select: { password: true } });
  return account?.password ? verifyPassword({ hash: account.password, password }) : false;
}

export const evaluationEditSchema = z.object(criteriaFields);
export type EvaluationEditInput = z.input<typeof evaluationEditSchema>;

/**
 * The unit manager changes the supervisor's evaluation while the request waits for them (D-120):
 * the criteria and the reviewer's note, never the supervisor's seal. The last editor and time are kept on
 * the evaluation, the change is audited (before and after) and the supervisor is told.
 */
export async function editEvaluation(actor: Actor, id: string, raw: EvaluationEditInput): Promise<Result> {
  assertCan(actor, "requests.review");
  if (actor.role !== "UNIT_MANAGER") return refuse("يعدّل التقييمَ مديرُ الوحدة.");
  const parsed = evaluationEditSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fieldRefusal(String(issue.path[0] ?? "criteria"), issue.message);
  }
  const statuses = await statusMap();
  const criteria: CriterionResult[] = REVIEW_CRITERIA.map((c) => {
    const r = parsed.data.criteria.find((x) => x.key === c.key)!;
    return { key: c.key, met: r.met, note: r.note };
  });
  return db.$transaction(async (tx) => {
    const request = await tx.request.findFirst({
      where: { AND: [scopeRequests(actor, "requests.review"), { id }] },
      select: { id: true, referenceNo: true, title: true, statusId: true, reviewStage: true, assignedSupervisorId: true },
    });
    if (!request) return refuse(MSG.unavailable);
    if (request.statusId !== statuses.UNDER_REVIEW.id || request.reviewStage !== "MANAGER") return refuse("يُعدَّل التقييم والطلب بانتظار اعتماد مدير الوحدة.");
    const current = await tx.requestEvaluation.findFirst({ where: { requestId: id }, orderBy: { createdAt: "desc" }, select: { id: true, criteria: true, note: true } });
    if (!current) return refuse("لم يقيّم المشرف الطلب بعد.");
    const before = { criteria: current.criteria, note: current.note };
    if (JSON.stringify(before) === JSON.stringify({ criteria, note: parsed.data.note })) return { ok: true };
    await tx.requestEvaluation.update({ where: { id: current.id }, data: { criteria, note: parsed.data.note, editedById: actor.id, editedAt: new Date() } });
    await audit({ actorId: actor.id, action: "request.evaluation_edited", entityType: "Request", entityId: id, before, after: { ...requestRef(request), criteria, note: parsed.data.note } }, tx);
    await notify(
      tx,
      [request.assignedSupervisorId],
      { type: "request.evaluation_edited", title: "عدّل مدير الوحدة تقييمك للطلب", body: `${request.referenceNo ?? ""} — ${request.title}`, requestId: id },
      actor.id,
    );
    return { ok: true };
  });
}

export const approvalSchema = z.object({ note: z.string().max(4000).default(""), ...signerFields });
export type ApprovalInput = z.input<typeof approvalSchema>;

/**
 * The unit manager's signed final approval (D-117), for one request or a bulk selection: the
 * password is checked once, then each request is approved with its own seal and verification code
 * (decisions.ts, D-122).
 */
export async function approveRequests(actor: Actor, ids: readonly string[], raw: ApprovalInput) {
  assertCan(actor, "requests.review");
  if (actor.role !== "UNIT_MANAGER") return refuse("الاعتماد النهائي لمدير الوحدة.");
  const parsed = approvalSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fieldRefusal(String(issue.path[0] ?? "password"), issue.message);
  }
  if (!(await passwordMatches(actor.id, parsed.data.password))) {
    await audit({ actorId: actor.id, action: "request.approval_password_failed", entityType: "Request", entityId: ids.length === 1 ? ids[0] : null, after: { count: ids.length } });
    return fieldRefusal("password", MSG.password);
  }
  return decideRequests(actor, ids, "approve", parsed.data.note, { passwordConfirmed: true });
}

/** The supervisor evaluates, signs and sends the request to the unit manager (D-116). */
export async function evaluateRequest(actor: Actor, id: string, raw: EvaluationInput): Promise<Result> {
  assertCan(actor, "requests.review");
  if (actor.role !== "SUPERVISOR") return refuse(MSG.notYours);
  const parsed = evaluationSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fieldRefusal(String(issue.path[0] ?? "criteria"), issue.message);
  }
  const input = parsed.data;
  const statuses = await statusMap();
  const request = await db.request.findFirst({
    where: { AND: [scopeRequests(actor, "requests.review"), { id }] },
    select: { id: true, referenceNo: true, title: true, statusId: true, assignedSupervisorId: true, reviewStage: true },
  });
  if (!request) return refuse(MSG.unavailable);
  if (request.statusId !== statuses.UNDER_REVIEW.id) return refuse(MSG.notUnderReview);
  if (request.assignedSupervisorId !== actor.id) return refuse(MSG.notYours);
  if (request.reviewStage !== "SUPERVISOR") return refuse(MSG.wrongStage);
  if (!(await passwordMatches(actor.id, input.password))) {
    await audit({ actorId: actor.id, action: "request.evaluation_password_failed", entityType: "Request", entityId: id, after: requestRef(request) });
    return fieldRefusal("password", MSG.password);
  }

  const criteria: CriterionResult[] = REVIEW_CRITERIA.map((c) => {
    const r = input.criteria.find((x) => x.key === c.key)!;
    return { key: c.key, met: r.met, note: r.note };
  });
  return db.$transaction(async (tx) => {
    const moved = await tx.request.updateMany({
      where: { id, statusId: statuses.UNDER_REVIEW.id, assignedSupervisorId: actor.id, reviewStage: "SUPERVISOR" },
      data: { reviewStage: "MANAGER" },
    });
    if (moved.count !== 1) return refuse(MSG.changed);
    const now = new Date();
    const evaluation = await tx.requestEvaluation.create({ data: { requestId: id, reviewerId: actor.id, criteria, note: input.note, createdAt: now } });
    const seal = await createSeal(tx, { kind: "EVALUATION", requestId: id, signerId: actor.id, evaluationId: evaluation.id, at: now });
    const met = criteria.filter((c) => c.met).length;
    await audit(
      {
        actorId: actor.id,
        action: "request.evaluated",
        entityType: "Request",
        entityId: id,
        after: { ...requestRef(request), evaluationId: evaluation.id, seal: seal.serial, criteriaMet: met, criteriaTotal: criteria.length },
      },
      tx,
    );
    await notify(
      tx,
      await activeManagerIds(tx),
      { type: "request.evaluated", title: "طلب بانتظار اعتمادكم", body: `${request.referenceNo ?? ""} — ${request.title}`, requestId: id },
      actor.id,
    );
    return { ok: true };
  });
}

type ScopeSnapshot = { program: { number: number; name: string } | null; initiatives: { number: number; name: string }[] };

async function scopeSnapshot(tx: Tx, programId: string | null, initiativeIds: string[]): Promise<ScopeSnapshot> {
  const [program, initiatives] = await Promise.all([
    programId ? tx.program.findUniqueOrThrow({ where: { id: programId }, select: { number: true, name: true } }) : null,
    tx.initiative.findMany({ where: { id: { in: initiativeIds } }, select: { id: true, number: true, name: true } }),
  ]);
  return { program, initiatives: initiativeIds.map((iid) => initiatives.find((i) => i.id === iid)!).map(({ number, name }) => ({ number, name })) };
}

/** Whether the actor may change the programme and initiatives now (D-116). */
export function canChangeScope(actor: Actor, r: { statusKey: string; reviewStage: "SUPERVISOR" | "MANAGER"; assignedSupervisorId: string | null }): boolean {
  if (!can(actor.role, "requests.review") || r.statusKey !== "UNDER_REVIEW") return false;
  if (actor.role === "UNIT_MANAGER") return true;
  return actor.role === "SUPERVISOR" && r.assignedSupervisorId === actor.id && r.reviewStage === "SUPERVISOR";
}

/**
 * The programme and initiatives the actor may choose for this request: open programmes of the
 * request's track (D-123), with their open initiatives.
 */
export async function scopeOptions(actor: Actor, trackId: string | null) {
  assertCan(actor, "requests.review");
  if (!trackId) return [];
  return db.program.findMany({
    where: { archivedAt: null, isActive: true, tracks: { some: { trackId } }, initiatives: { some: availableInitiativeWhere } },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
    select: { id: true, number: true, name: true, initiatives: { where: availableInitiativeWhere, orderBy: { number: "asc" }, select: { id: true, number: true, name: true } } },
  });
}

/**
 * Classifies the request under a programme of its track and initiatives of that programme, or moves
 * it to others (D-116, D-123). Optional: a request can be decided without it. The change is
 * recorded for the staff and audited, and the assigned supervisor is told when the unit manager
 * made it. Files and data stay as they are.
 */
export async function changeRequestScope(actor: Actor, id: string, input: { programId: string; initiativeIds: string[]; note?: string }): Promise<Result> {
  assertCan(actor, "requests.review");
  const ids = [...new Set(input.initiativeIds)];
  if (ids.length === 0) return fieldRefusal("initiativeIds", MSG.initiativesMissing);
  const parsedNote = note.safeParse(input.note ?? "");
  if (!parsedNote.success) return fieldRefusal("note", parsedNote.error.issues[0].message);
  const statuses = await statusMap();
  const request = await db.request.findFirst({
    where: { AND: [scopeRequests(actor, "requests.review"), { id }] },
    select: {
      id: true,
      referenceNo: true,
      title: true,
      statusId: true,
      reviewStage: true,
      programId: true,
      trackId: true,
      assignedSupervisorId: true,
      initiatives: { orderBy: [{ sortOrder: "asc" }, { initiativeId: "asc" }], select: { initiativeId: true } },
    },
  });
  if (!request) return refuse(MSG.unavailable);
  const statusKey = request.statusId === statuses.UNDER_REVIEW.id ? "UNDER_REVIEW" : "OTHER";
  if (!canChangeScope(actor, { statusKey, reviewStage: request.reviewStage, assignedSupervisorId: request.assignedSupervisorId })) return refuse(MSG.scopeNotAllowed);
  const program = await db.program.findFirst({
    where: { id: input.programId, archivedAt: null, isActive: true },
    select: { id: true, tracks: { where: { trackId: request.trackId ?? "" }, select: { trackId: true } } },
  });
  if (!program) return fieldRefusal("programId", MSG.programUnavailable);
  if (program.tracks.length === 0) return fieldRefusal("programId", MSG.programOutsideTrack);
  const found = await db.initiative.count({ where: { id: { in: ids }, programId: program.id, ...availableInitiativeWhere } });
  if (found !== ids.length) return fieldRefusal("initiativeIds", MSG.initiativesUnavailable);
  const beforeIds = request.initiatives.map((l) => l.initiativeId);
  if (request.programId === program.id && beforeIds.join() === ids.join()) return refuse(MSG.unchanged);

  return db.$transaction(async (tx) => {
    const before = await scopeSnapshot(tx, request.programId, beforeIds);
    const updated = await tx.request.updateMany({
      where: { id, statusId: statuses.UNDER_REVIEW.id, reviewStage: request.reviewStage, programId: request.programId },
      data: { programId: program.id, initiativeId: ids[0] },
    });
    if (updated.count !== 1) return refuse(MSG.changed);
    await tx.requestInitiative.deleteMany({ where: { requestId: id } });
    await tx.requestInitiative.createMany({ data: ids.map((initiativeId, sortOrder) => ({ requestId: id, initiativeId, sortOrder })) });
    const after = await scopeSnapshot(tx, program.id, ids);
    await tx.requestScopeChange.create({ data: { requestId: id, actorId: actor.id, before, after, note: parsedNote.data } });
    await audit({ actorId: actor.id, action: "request.scope_changed", entityType: "Request", entityId: id, before, after: { ...requestRef(request), ...after, note: parsedNote.data } }, tx);
    if (actor.role === "UNIT_MANAGER") {
      await notify(
        tx,
        [request.assignedSupervisorId],
        { type: "request.scope_changed", title: "عدّل مدير الوحدة برنامج الطلب أو مبادراته", body: `${request.referenceNo ?? ""} — ${request.title}`, requestId: id },
        actor.id,
      );
    }
    return { ok: true };
  });
}
