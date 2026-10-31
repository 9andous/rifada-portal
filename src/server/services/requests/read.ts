import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CriterionResult } from "@/config/review-criteria";
import type { MissingItem } from "@/lib/completeness";
import { enumParam, firstParam, pageWindow, parseListParams, type Page, type SearchParams } from "@/lib/list-params";
import {
  EDITABLE_STATUS_KEYS,
  OPEN_STATUS_KEYS,
  parseCustomValues,
  parseRequirementSnapshot,
  type RequirementSpec,
} from "@/lib/requests";
import { statusTone, SYSTEM_STATUS_KEYS, type SystemStatusKey } from "@/lib/workflow";
import type { StatusTone } from "@/components/ui/surface";
import { can } from "@/server/authz/permissions";
import { ROLE_LABELS, type Role } from "@/server/authz/roles";
import { scopeComments, scopeRequests, type Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { PAGE_SIZE, assertCan, containsAny } from "@/server/services/admin/common";
import { audit } from "@/server/services/audit";
import { rankedSupervisors } from "./assignment";
import { statusMap } from "./common";
import { isDecider } from "./decisions";
import { canChangeScope } from "./review";

// Request read paths (Phase 3). Every query starts from `scopeRequests` (drafts only for their own
// association, D-079) and comments from `scopeComments` (internal notes never for officers). The
// detail is shaped per role: the officer's version is built without any internal data.

export type StatusView = { key: SystemStatusKey; name: string; tone: StatusTone };
const statusView = (s: { key: string; name: string; colorToken: string }): StatusView => ({ key: s.key as SystemStatusKey, name: s.name, tone: statusTone(s.colorToken) });

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** Open statuses the unit is responsible for; only these can be overdue against the review deadline. */
const SLA_STATUS_KEYS = ["SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW"] as const;

export const REQUEST_SORTS = ["submittedAt", "updatedAt", "slaDueAt", "title", "referenceNo"] as const;
export type RequestSort = (typeof REQUEST_SORTS)[number];

/** mine = the officer's association; queue = assigned to the supervisor and open; scope = everything the actor may read. */
export type RequestListView = "mine" | "queue" | "scope";

export function parseRequestListParams(params: SearchParams, view: RequestListView) {
  const supervisor = firstParam(params, "supervisor");
  const track = firstParam(params, "track");
  const program = firstParam(params, "program");
  const association = firstParam(params, "association");
  return {
    ...parseListParams(params, REQUEST_SORTS, { sort: view === "mine" ? "updatedAt" : "submittedAt", dir: "desc" }),
    status: enumParam(params, "status", SYSTEM_STATUS_KEYS),
    track: track && /^[a-z0-9]{8,40}$/.test(track) ? track : undefined,
    /** Classified requests only (D-123): the dashboards link here. */
    program: program && /^[a-z0-9]{8,40}$/.test(program) ? program : undefined,
    supervisor: supervisor === "none" || (supervisor && /^[a-z0-9]{8,40}$/.test(supervisor)) ? supervisor : undefined,
    association: association && /^[a-z0-9]{8,40}$/.test(association) ? association : undefined,
    /** Only requests past their review deadline in a status the unit is responsible for. */
    overdue: firstParam(params, "overdue") === "1",
    /** Under review and waiting for the unit manager after the supervisor's evaluation (D-116). */
    stage: enumParam(params, "stage", ["manager", "supervisor"] as const),
  };
}
export type RequestListParams = ReturnType<typeof parseRequestListParams>;

async function baseWhere(actor: Actor, view: RequestListView): Promise<Prisma.RequestWhereInput> {
  assertCan(actor, "requests.read");
  const scope = scopeRequests(actor);
  if (view === "mine") return actor.role === "ASSOCIATION_OFFICER" ? scope : { id: { in: [] } };
  if (view === "queue") {
    const statuses = await statusMap();
    return { AND: [scope, { assignedSupervisorId: actor.id, statusId: { in: OPEN_STATUS_KEYS.map((k) => statuses[k].id) } }] };
  }
  return scope;
}

const listSelect = {
  id: true,
  referenceNo: true,
  title: true,
  submittedAt: true,
  updatedAt: true,
  slaDueAt: true,
  decidedAt: true,
  assignedSupervisorId: true,
  reviewStage: true,
  status: { select: { key: true, name: true, colorToken: true } },
  track: { select: { id: true, number: true, name: true } },
  requestType: { select: { name: true } },
  program: { select: { id: true, number: true, name: true } },
  initiative: { select: { number: true, name: true } },
  association: { select: { name: true } },
  assignedSupervisor: { select: { name: true, isActive: true } },
} satisfies Prisma.RequestSelect;

export type RequestRow = {
  id: string;
  referenceNo: string | null;
  title: string;
  status: StatusView;
  /** Chosen by the association (D-123). */
  track: { id: string; number: number; name: string } | null;
  requestType: string | null;
  /** Set only when the supervisor classified the request (D-123). */
  program: { id: string; number: number; name: string } | null;
  initiative: { number: number; name: string } | null;
  association: string;
  supervisor: { name: string; isActive: boolean } | null;
  submittedAt: Date | null;
  updatedAt: Date;
  slaDueAt: Date | null;
  overdue: boolean;
  /** The viewer may return or reject it now (and approve it, when `approvable`). */
  decidable: boolean;
  /** The unit manager may give the final approval: the supervisor has evaluated it (D-116). */
  approvable: boolean;
  /** Staff only: under review and with the unit manager (D-116). */
  withManager: boolean;
};

export async function listRequests(actor: Actor, params: RequestListParams, view: RequestListView, now: Date = new Date()): Promise<Page<RequestRow>> {
  const base = await baseWhere(actor, view);
  const and: Prisma.RequestWhereInput[] = [base];
  if (params.status) and.push({ status: { key: params.status } });
  if (params.track) and.push({ trackId: params.track });
  if (params.program) and.push({ programId: params.program });
  if (params.association) and.push({ associationId: params.association });
  if (params.supervisor === "none") and.push({ assignedSupervisorId: null });
  else if (params.supervisor) and.push({ assignedSupervisorId: params.supervisor });
  if (params.q) and.push({ OR: [...containsAny(params.q, ["title", "referenceNo"] as const), { association: { name: { contains: params.q, mode: "insensitive" } } }] });
  if (params.overdue) and.push({ status: { key: { in: [...SLA_STATUS_KEYS] } }, slaDueAt: { lt: now } });
  if (params.stage && actor.role !== "ASSOCIATION_OFFICER") and.push({ status: { key: "UNDER_REVIEW" }, reviewStage: params.stage === "manager" ? "MANAGER" : "SUPERVISOR" });
  const where: Prisma.RequestWhereInput = { AND: and };

  const total = await db.request.count({ where });
  const win = pageWindow(total, params.page, PAGE_SIZE);
  const orderBy: Prisma.RequestOrderByWithRelationInput[] = [
    params.sort === "submittedAt" || params.sort === "slaDueAt" || params.sort === "referenceNo"
      ? { [params.sort]: { sort: params.dir, nulls: "last" } }
      : { [params.sort]: params.dir },
    { id: "asc" },
  ];
  const rows = await db.request.findMany({ where, orderBy, skip: win.skip, take: win.take, select: listSelect });
  const slaKeys: readonly string[] = SLA_STATUS_KEYS;
  const items = rows.map((r) => ({
    id: r.id,
    referenceNo: r.referenceNo,
    title: r.title,
    status: statusView(r.status),
    track: r.track,
    requestType: r.requestType?.name ?? null,
    program: r.program,
    initiative: r.initiative,
    association: r.association.name,
    supervisor: r.assignedSupervisor,
    submittedAt: r.submittedAt,
    updatedAt: r.updatedAt,
    slaDueAt: r.slaDueAt,
    overdue: Boolean(r.slaDueAt && slaKeys.includes(r.status.key) && r.slaDueAt < now),
    decidable: r.status.key === "UNDER_REVIEW" && isDecider(actor, r.assignedSupervisorId) && (actor.role === "UNIT_MANAGER" || r.reviewStage === "SUPERVISOR"),
    approvable: r.status.key === "UNDER_REVIEW" && actor.role === "UNIT_MANAGER" && isDecider(actor, r.assignedSupervisorId) && r.reviewStage === "MANAGER",
    withManager: actor.role !== "ASSOCIATION_OFFICER" && r.status.key === "UNDER_REVIEW" && r.reviewStage === "MANAGER",
  }));
  return { items, total, page: win.page, pageSize: PAGE_SIZE, pageCount: win.pageCount };
}

/** Counts per status for the big status numbers (all statuses in order, zeros included). */
export async function requestStatusCounts(actor: Actor, view: RequestListView): Promise<(StatusView & { count: number })[]> {
  const base = await baseWhere(actor, view);
  const [statuses, grouped] = await Promise.all([
    db.requestStatus.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, key: true, name: true, colorToken: true } }),
    db.request.groupBy({ by: ["statusId"], where: base, _count: { _all: true } }),
  ]);
  const showDrafts = view === "mine";
  return statuses
    .filter((s) => showDrafts || s.key !== "DRAFT")
    .filter((s) => view !== "queue" || (OPEN_STATUS_KEYS as readonly string[]).includes(s.key))
    .map((s) => ({ ...statusView(s), count: grouped.find((g) => g.statusId === s.id)?._count._all ?? 0 }));
}

/** Tracks and supervisors offered in the list filters, limited to the actor's scope. */
export async function requestFilterOptions(actor: Actor) {
  assertCan(actor, "requests.read");
  const trackWhere: Prisma.TrackWhereInput = actor.role === "SUPERVISOR" ? { id: { in: [...actor.trackIds] } } : {};
  const [tracks, supervisors] = await Promise.all([
    db.track.findMany({ where: trackWhere, orderBy: [{ sortOrder: "asc" }, { number: "asc" }], select: { id: true, number: true, name: true } }),
    actor.role === "UNIT_MANAGER" || actor.role === "SUPER_ADMIN"
      ? db.user.findMany({ where: { role: "SUPERVISOR" }, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } })
      : Promise.resolve([]),
  ]);
  return { tracks, supervisors };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export type VersionView = { id: string; versionNo: number; fileName: string; size: number; createdAt: Date; uploadedBy: string };
export type FileView = { attachmentId: string; title: string; current: VersionView | null; versions: VersionView[] };
export type RequirementRowView = RequirementSpec & { value: string | null; files: FileView[] };

export type ScopeSnapshotView = { program: { number: number; name: string } | null; initiatives: { number: number; name: string }[] };

/** Staff only (D-116): who acts next, the supervisor's signed evaluations and scope changes. */
export type ReviewView = {
  stage: "SUPERVISOR" | "MANAGER";
  evaluations: {
    id: string;
    reviewer: string;
    criteria: CriterionResult[];
    note: string | null;
    /** The electronic seal of the supervisor's signing (D-122). */
    seal: SealView | null;
    createdAt: Date;
    /** The unit manager's last change to the criteria or the note (D-120). */
    edited: { by: string; at: Date } | null;
  }[];
  /** The unit manager's signed final approvals (D-117). */
  approvals: { id: string; manager: string; seal: (SealView & { verifyCode: string | null }) | null; createdAt: Date }[];
  scopeChanges: { id: string; actor: string; actorRole: string; before: ScopeSnapshotView; after: ScopeSnapshotView; note: string | null; createdAt: Date }[];
};

export type SealView = { serial: string };

/**
 * The approved document's electronic seals and verification code (D-122), for every reader of an
 * approved request, the association included: the printed copy carries them.
 */
export type CertificateView = {
  verifyCode: string;
  signers: { kind: "EVALUATION" | "APPROVAL"; name: string; serial: string; signedAt: Date }[];
};

export type TimelineEntry = { id: string; from: StatusView | null; to: StatusView; actor: string | null; note: string | null; createdAt: Date };

export type CommentView = {
  id: string;
  author: { name: string; role: string; isStaff: boolean };
  body: string;
  isInternal: boolean;
  isReply: boolean;
  createdAt: Date;
  files: FileView[];
};

export type RequestCapabilities = {
  canEdit: boolean;
  canDiscard: boolean;
  /** The formal document: staff always; the association only once the request is approved (D-114). */
  canPrint: boolean;
  /** Return or reject: the assigned supervisor before sending to the manager, the manager always. */
  canDecide: boolean;
  /** «تقييم واعتماد»: the assigned supervisor, at the supervisor stage (D-116). */
  canEvaluate: boolean;
  /** Final approval: the unit manager, once the supervisor has evaluated and signed (D-116). */
  canApprove: boolean;
  /** Change the programme and initiatives, never the content (D-116). */
  canChangeScope: boolean;
  /** The unit manager changes the supervisor's evaluation before deciding (D-120). */
  canEditEvaluation: boolean;
  canReassign: boolean;
  canComment: boolean;
  canWriteInternal: boolean;
  canUploadToComment: boolean;
  showAuditTrail: boolean;
  /** Staff viewing a returned request: the association may still be changing it (D-078). */
  returnedNotice: boolean;
};

const versionSelect = { id: true, versionNo: true, fileName: true, size: true, createdAt: true, uploadedBy: { select: { name: true } } } satisfies Prisma.AttachmentVersionSelect;

type AttachmentRow = {
  id: string;
  title: string;
  currentVersionId: string | null;
  attachmentType?: { key: string } | null;
  versions: { id: string; versionNo: number; fileName: string; size: number; createdAt: Date; uploadedBy: { name: string } }[];
};

function fileView(a: AttachmentRow): FileView {
  const versions = [...a.versions]
    .sort((x, y) => y.versionNo - x.versionNo)
    .map((v) => ({ id: v.id, versionNo: v.versionNo, fileName: v.fileName, size: v.size, createdAt: v.createdAt, uploadedBy: v.uploadedBy.name }));
  return { attachmentId: a.id, title: a.title, current: versions.find((v) => v.id === a.currentVersionId) ?? versions[0] ?? null, versions };
}

/** The latest approval's seal and the supervisor's seal it approved (D-122). */
async function requestCertificate(requestId: string): Promise<CertificateView | null> {
  const approval = await db.requestApproval.findFirst({
    where: { requestId },
    orderBy: { createdAt: "desc" },
    select: { seal: { select: { serial: true, verifyCode: true, payload: true, createdAt: true, signer: { select: { name: true } } } } },
  });
  const seal = approval?.seal;
  if (!seal?.verifyCode) return null;
  const { evaluationSeal } = JSON.parse(seal.payload) as { evaluationSeal?: string };
  const evaluation = evaluationSeal
    ? await db.requestSeal.findUnique({ where: { serial: evaluationSeal }, select: { serial: true, createdAt: true, signer: { select: { name: true } } } })
    : null;
  return {
    verifyCode: seal.verifyCode,
    signers: [
      ...(evaluation ? [{ kind: "EVALUATION" as const, name: evaluation.signer.name, serial: evaluation.serial, signedAt: evaluation.createdAt }] : []),
      { kind: "APPROVAL" as const, name: seal.signer.name, serial: seal.serial, signedAt: seal.createdAt },
    ],
  };
}

/**
 * The request page for any role, or null when the actor may not read it (drafts of other
 * associations and every draft for staff included). Opening a submitted request as super admin is
 * audited (D-071).
 */
export async function getRequestDetail(actor: Actor, id: string) {
  if (!can(actor.role, "requests.read")) return null;
  const request = await db.request.findFirst({
    where: { AND: [scopeRequests(actor), { id }] },
    include: {
      status: { select: { key: true, name: true, colorToken: true } },
      track: {
        select: {
          id: true,
          number: true,
          name: true,
          programs: { orderBy: { program: { number: "asc" } }, select: { program: { select: { id: true, number: true, name: true, description: true, archivedAt: true } } } },
        },
      },
      requestType: { select: { id: true, name: true } },
      program: { select: { id: true, number: true, name: true, isActive: true, archivedAt: true } },
      initiative: { select: { id: true, number: true, name: true, isActive: true, archivedAt: true } },
      initiatives: { orderBy: [{ sortOrder: "asc" }, { initiativeId: "asc" }], select: { initiative: { select: { id: true, number: true, name: true } } } },
      association: { select: { id: true, name: true, isActive: true } },
      createdBy: { select: { name: true } },
      assignedSupervisor: { select: { id: true, name: true, username: true, isActive: true } },
      attachments: {
        where: { ownerType: "REQUEST" },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, currentVersionId: true, attachmentType: { select: { key: true } }, versions: { select: versionSelect } },
      },
    },
  });
  if (!request) return null;
  const isOfficer = actor.role === "ASSOCIATION_OFFICER";
  const statusKey = request.status.key as SystemStatusKey;
  const editable = (EDITABLE_STATUS_KEYS as readonly string[]).includes(statusKey);

  // Initiative requirements no longer apply to new requests (D-123); those submitted before keep
  // the requirements recorded at their submission.
  const specs = (!editable && parseRequirementSnapshot(request.requirementsSnapshot)) || [];
  const custom = parseCustomValues(request.customFields);
  const files = request.attachments.map((a) => ({ typeKey: a.attachmentType?.key ?? null, view: fileView(a) }));
  const attachmentKeys = new Set(specs.filter((s) => s.kind === "ATTACHMENT").map((s) => s.attachmentType?.key ?? s.key));
  const requirements: RequirementRowView[] = specs.map((s) => ({
    ...s,
    value: s.kind === "FIELD" ? (custom[s.key] ?? null) : null,
    files: s.kind === "ATTACHMENT" ? files.filter((f) => f.typeKey === (s.attachmentType?.key ?? s.key)).map((f) => f.view) : [],
  }));
  const fieldKeys = new Set(specs.filter((s) => s.kind === "FIELD").map((s) => s.key));
  const otherValues = Object.entries(custom).filter(([k, v]) => !fieldKeys.has(k) && v.trim()).map(([key, value]) => ({ key, value }));
  const otherFiles = files.filter((f) => !f.typeKey || !attachmentKeys.has(f.typeKey)).map((f) => f.view);

  const [history, check, comments] = await Promise.all([
    db.requestStatusHistory.findMany({
      where: { requestId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        note: true,
        createdAt: true,
        fromStatus: { select: { key: true, name: true, colorToken: true } },
        toStatus: { select: { key: true, name: true, colorToken: true } },
        actor: { select: { name: true } },
      },
    }),
    db.completenessCheck.findFirst({ where: { requestId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { passed: true, missing: true, ranBy: true, createdAt: true } }),
    db.comment.findMany({
      where: { AND: [scopeComments(actor), { requestId: id }] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        body: true,
        isInternal: true,
        parentId: true,
        createdAt: true,
        author: { select: { name: true, role: true } },
        attachments: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, currentVersionId: true, versions: { select: versionSelect } } },
      },
    }),
  ]);

  const timeline: TimelineEntry[] = history.map((h) => ({
    id: h.id,
    from: h.fromStatus ? statusView(h.fromStatus) : null,
    to: statusView(h.toStatus),
    actor: h.actor?.name ?? null,
    note: h.note,
    createdAt: h.createdAt,
  }));

  const commentViews: CommentView[] = comments.map((c) => ({
    id: c.id,
    author: { name: c.author.name, role: ROLE_LABELS[c.author.role as Role] ?? "", isStaff: c.author.role !== "ASSOCIATION_OFFICER" },
    body: c.body,
    // Officers never receive internal rows (scopeComments); the flag is still false for them.
    isInternal: isOfficer ? false : c.isInternal,
    isReply: Boolean(c.parentId),
    createdAt: c.createdAt,
    files: c.attachments.map(fileView),
  }));

  const open = (OPEN_STATUS_KEYS as readonly string[]).includes(statusKey);
  const submitted = request.referenceNo !== null;
  const capabilities: RequestCapabilities = {
    canEdit: isOfficer && editable && request.association.isActive && can(actor.role, "requests.editDraft"),
    canDiscard: isOfficer && statusKey === "DRAFT" && !submitted,
    canPrint: !isOfficer || statusKey === "APPROVED",
    canDecide: statusKey === "UNDER_REVIEW" && isDecider(actor, request.assignedSupervisorId) && (actor.role === "UNIT_MANAGER" || request.reviewStage === "SUPERVISOR"),
    canEvaluate: statusKey === "UNDER_REVIEW" && actor.role === "SUPERVISOR" && isDecider(actor, request.assignedSupervisorId) && request.reviewStage === "SUPERVISOR",
    canApprove: statusKey === "UNDER_REVIEW" && actor.role === "UNIT_MANAGER" && can(actor.role, "requests.review") && request.reviewStage === "MANAGER",
    canChangeScope: canChangeScope(actor, { statusKey, reviewStage: request.reviewStage, assignedSupervisorId: request.assignedSupervisorId }),
    // The evaluation exists exactly when the request waits for the manager (D-116).
    canEditEvaluation: statusKey === "UNDER_REVIEW" && actor.role === "UNIT_MANAGER" && can(actor.role, "requests.review") && request.reviewStage === "MANAGER",
    canReassign: open && submitted && can(actor.role, "requests.assign"),
    canComment: submitted && can(actor.role, "comments.write"),
    canWriteInternal: submitted && can(actor.role, "comments.writeInternal"),
    canUploadToComment: submitted && can(actor.role, "comments.write") && can(actor.role, "attachments.upload"),
    showAuditTrail: can(actor.role, "requests.auditTrail"),
    returnedNotice: !isOfficer && statusKey === "RETURNED",
  };

  // The two-step review is the unit's own business: none of it reaches the association (D-116).
  let review: ReviewView | null = null;
  if (!isOfficer) {
    const [evaluations, approvals, scopeChanges] = await Promise.all([
      db.requestEvaluation.findMany({
        where: { requestId: id },
        orderBy: { createdAt: "asc" },
        select: { id: true, criteria: true, note: true, seal: { select: { serial: true } }, createdAt: true, editedAt: true, reviewer: { select: { name: true } }, editedBy: { select: { name: true } } },
      }),
      db.requestApproval.findMany({
        where: { requestId: id },
        orderBy: { createdAt: "asc" },
        select: { id: true, seal: { select: { serial: true, verifyCode: true } }, createdAt: true, manager: { select: { name: true } } },
      }),
      db.requestScopeChange.findMany({
        where: { requestId: id },
        orderBy: { createdAt: "asc" },
        select: { id: true, before: true, after: true, note: true, createdAt: true, actor: { select: { name: true, role: true } } },
      }),
    ]);
    review = {
      stage: request.reviewStage,
      evaluations: evaluations.map((e) => ({
        id: e.id,
        reviewer: e.reviewer.name,
        criteria: (Array.isArray(e.criteria) ? e.criteria : []) as CriterionResult[],
        note: e.note,
        seal: e.seal,
        createdAt: e.createdAt,
        edited: e.editedAt && e.editedBy ? { by: e.editedBy.name, at: e.editedAt } : null,
      })),
      approvals: approvals.map((a) => ({ id: a.id, manager: a.manager.name, seal: a.seal, createdAt: a.createdAt })),
      scopeChanges: scopeChanges.map((c) => ({
        id: c.id,
        actor: c.actor.name,
        actorRole: ROLE_LABELS[c.actor.role as Role] ?? "",
        before: c.before as ScopeSnapshotView,
        after: c.after as ScopeSnapshotView,
        note: c.note,
        createdAt: c.createdAt,
      })),
    };
  }

  let assignment = null;
  if (!isOfficer) {
    const rows = await db.assignmentHistory.findMany({
      where: { requestId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, reason: true, createdAt: true, fromUser: { select: { name: true } }, toUser: { select: { name: true } }, actor: { select: { name: true } } },
    });
    assignment = {
      supervisor: request.assignedSupervisor ? { id: request.assignedSupervisor.id, name: request.assignedSupervisor.name, isActive: request.assignedSupervisor.isActive } : null,
      history: rows.map((r) => ({ id: r.id, from: r.fromUser?.name ?? null, to: r.toUser?.name ?? null, actor: r.actor?.name ?? null, reason: r.reason, createdAt: r.createdAt })),
      candidates: capabilities.canReassign ? (await rankedSupervisors(db, request.trackId)).filter((s) => s.id !== request.assignedSupervisorId) : [],
    };
  }

  const auditTrail = capabilities.showAuditTrail && request.submittedAt ? await requestAuditTrail(id, request.submittedAt) : null;
  const certificate = statusKey === "APPROVED" ? await requestCertificate(id) : null;

  if (actor.role === "SUPER_ADMIN") {
    await audit({ actorId: actor.id, action: "request.viewed_by_admin", entityType: "Request", entityId: id, after: { referenceNo: request.referenceNo, title: request.title } });
  }

  return {
    id: request.id,
    referenceNo: request.referenceNo,
    title: request.title,
    description: request.description,
    targetAudience: request.targetAudience,
    goals: request.goals,
    location: request.location,
    startDate: request.startDate,
    endDate: request.endDate,
    expectedBeneficiaries: request.expectedBeneficiaries,
    estimatedBudget: request.estimatedBudget,
    kpis: request.kpis,
    partners: request.partners,
    status: statusView(request.status),
    track: request.track ? { id: request.track.id, number: request.track.number, name: request.track.name } : null,
    requestType: request.requestType,
    /** The programmes the track covers, for the staff to see where the request belongs (D-123). */
    trackPrograms: isOfficer ? [] : (request.track?.programs ?? []).map((l) => l.program).filter((p) => !p.archivedAt).map(({ archivedAt: _, ...p }) => p),
    program: request.program ? { id: request.program.id, number: request.program.number, name: request.program.name } : null,
    initiative: request.initiative ? { id: request.initiative.id, number: request.initiative.number, name: request.initiative.name } : null,
    /** Every chosen initiative, the main one first (D-115). */
    initiatives: request.initiatives.map((l) => l.initiative),
    association: { name: request.association.name },
    createdBy: request.createdBy.name,
    createdAt: request.createdAt,
    submittedAt: request.submittedAt,
    decidedAt: request.decidedAt,
    slaDueAt: request.slaDueAt,
    updatedAt: request.updatedAt,
    requirements,
    otherValues,
    otherFiles,
    completeness: check ? { passed: check.passed, missing: (Array.isArray(check.missing) ? check.missing : []) as MissingItem[], ranBy: check.ranBy, createdAt: check.createdAt } : null,
    timeline,
    comments: commentViews,
    assignment,
    review,
    certificate,
    auditTrail,
    capabilities,
  };
}

export type RequestDetail = NonNullable<Awaited<ReturnType<typeof getRequestDetail>>>;

/**
 * Audit entries of one request from its first submission on, newest first (super admin and unit
 * manager, D-072). Entries from the draft period stay out, like the draft itself (change 19).
 */
async function requestAuditTrail(id: string, since: Date) {
  const rows = await db.auditLog.findMany({
    where: { entityType: "Request", entityId: id, createdAt: { gte: since } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    select: { id: true, action: true, createdAt: true, actor: { select: { name: true, role: true } } },
  });
  return rows.map((r) => ({ id: r.id, action: r.action, createdAt: r.createdAt, actor: r.actor ? { name: r.actor.name, role: ROLE_LABELS[r.actor.role as Role] ?? "" } : null }));
}
