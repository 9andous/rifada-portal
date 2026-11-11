import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { decideRequests } from "@/server/services/requests/decisions";
import { getRequestDetail, listRequests, parseRequestListParams } from "@/server/services/requests/read";
import { approveRequests, changeRequestScope, editEvaluation, evaluateRequest } from "@/server/services/requests/review";
import { reassignRequests } from "@/server/services/requests/assignment";
import { submitRequest } from "@/server/services/requests/submit";
import { saveDraft } from "@/server/services/requests/drafts";
import { db, resetDatabase } from "../support/db";
import { decideThroughManager, evaluationInput, makeRequestWorld, managerSignature, submittedRequest, validDraft, type RequestWorld } from "../support/requests";

// The two-step review (D-116): the supervisor's signed evaluation, the unit manager's final
// decision, and programme/initiative changes, all invisible to the association.

const storageRoot = mkdtempSync(join(tmpdir(), "rifada-requests-review-"));
const previousStorage = process.env.STORAGE_DIR;
beforeAll(() => {
  process.env.STORAGE_DIR = storageRoot;
});
afterAll(() => {
  process.env.STORAGE_DIR = previousStorage;
  rmSync(storageRoot, { recursive: true, force: true });
});

let w: RequestWorld;
beforeEach(async () => {
  await resetDatabase();
  rmSync(storageRoot, { recursive: true, force: true });
  w = await makeRequestWorld();
});

const stageOf = async (id: string) => (await db.request.findUniqueOrThrow({ where: { id }, select: { reviewStage: true } })).reviewStage;
const statusOf = async (id: string) => (await db.request.findUniqueOrThrow({ where: { id }, include: { status: true } })).status.key;

const holderOf = async (id: string) => {
  const sup = (await db.request.findUniqueOrThrow({ where: { id } })).assignedSupervisorId;
  return sup === w.users.supervisor2.id ? w.actors.supervisor2 : w.actors.supervisor;
};

describe("«تقييم واعتماد» by the supervisor", () => {
  it("replaces the supervisor's direct approval; return and reject stay, straight to the association", async () => {
    const { id } = await submittedRequest(w);
    const r = await decideRequests(w.actors.supervisor, [id], "approve");
    expect(r.ok && r.outcome.skipped[0]?.reason).toMatch(/تقييم واعتماد/);
    expect(await statusOf(id)).toBe("UNDER_REVIEW");
    const detail = await getRequestDetail(w.actors.supervisor, id);
    expect(detail?.capabilities).toMatchObject({ canEvaluate: true, canApprove: false, canDecide: true, canChangeScope: true });

    const returned = await decideRequests(w.actors.supervisor, [id], "return", "البيانات المرسلة غير صحيحة");
    expect(returned.ok && returned.outcome.done).toHaveLength(1);
    expect(await statusOf(id)).toBe("RETURNED");
    expect(await db.notification.count({ where: { userId: w.users.officer.id, requestId: id, type: "request.returned" } })).toBe(1);
    expect(await db.requestEvaluation.count({ where: { requestId: id } })).toBe(0);

    const second = await submittedRequest(w);
    const rejected = await decideRequests(await holderOf(second.id), [second.id], "reject", "الطلب خارج اختصاص الجمعية");
    expect(rejected.ok && rejected.outcome.done).toHaveLength(1);
    expect(await statusOf(second.id)).toBe("REJECTED");
  });

  it("lets another supervisor of the track return it directly and take it; another track may not", async () => {
    const { id } = await submittedRequest(w);
    const assigned = (await db.request.findUniqueOrThrow({ where: { id } })).assignedSupervisorId!;
    const [other, otherUser] = assigned === w.users.supervisor.id ? [w.actors.supervisor2, w.users.supervisor2] : [w.actors.supervisor, w.users.supervisor];
    const refused = await decideRequests(w.actors.supervisorP2, [id], "return", "أرفقوا الخطة");
    expect(refused.ok && refused.outcome.skipped).toHaveLength(1);
    const done = await decideRequests(other, [id], "return", "أرفقوا الخطة");
    expect(done.ok && done.outcome.done).toHaveLength(1);
    expect((await db.request.findUniqueOrThrow({ where: { id } })).assignedSupervisorId).toBe(otherUser.id);
    expect(await db.notification.count({ where: { userId: assigned, requestId: id, type: "request.reassigned_away" } })).toBe(1);
  });

  it("needs every criterion and the right password; a wrong password is audited", async () => {
    const { id } = await submittedRequest(w);
    const s = w.actors.supervisor;
    expect(await evaluateRequest(s, id, evaluationInput({ criteria: evaluationInput().criteria.slice(1) }))).toMatchObject({ ok: false, errors: { criteria: expect.any(String) } });
    expect(await evaluateRequest(s, id, evaluationInput({ password: "" }))).toMatchObject({ ok: false, errors: { password: expect.any(String) } });
    expect(await evaluateRequest(s, id, evaluationInput({ password: "wrong-password" }))).toMatchObject({ ok: false, errors: { password: expect.any(String) } });
    expect(await db.auditLog.count({ where: { action: "request.evaluation_password_failed", entityId: id } })).toBe(1);
    expect(await stageOf(id)).toBe("SUPERVISOR");
    expect(await db.requestEvaluation.count()).toBe(0);
    expect(await db.requestSeal.count()).toBe(0);
  });

  it("any supervisor of the track evaluates, once, and takes the request; another track cannot", async () => {
    const { id } = await submittedRequest(w);
    const assigned = (await db.request.findUniqueOrThrow({ where: { id } })).assignedSupervisorId;
    const [other, otherUser] = assigned === w.users.supervisor.id ? [w.actors.supervisor2, w.users.supervisor2] : [w.actors.supervisor, w.users.supervisor];
    expect(await getRequestDetail(other, id)).toMatchObject({ capabilities: { canEvaluate: true, canChangeScope: true, canDecide: true } });
    expect(await evaluateRequest(w.actors.supervisorP2, id, evaluationInput())).toMatchObject({ ok: false });

    const [first, second] = await Promise.all([evaluateRequest(other, id, evaluationInput()), evaluateRequest(other, id, evaluationInput())]);
    expect([first, second].filter((r) => r.ok)).toHaveLength(1);
    expect(await db.requestEvaluation.count({ where: { requestId: id } })).toBe(1);
    expect(await stageOf(id)).toBe("MANAGER");
    const row = await db.request.findUniqueOrThrow({ where: { id } });
    expect(row.assignedSupervisorId).toBe(otherUser.id);
    expect(await db.assignmentHistory.findFirstOrThrow({ where: { requestId: id }, orderBy: { createdAt: "desc" } })).toMatchObject({ fromUserId: assigned, toUserId: otherUser.id, actorId: otherUser.id });
    expect(await db.notification.count({ where: { userId: assigned!, requestId: id, type: "request.reassigned_away" } })).toBe(1);
  });

  it("the assigned supervisor evaluates, once; the request goes to the unit manager", async () => {
    const { id } = await submittedRequest(w);
    expect(await evaluateRequest(w.actors.manager, id, evaluationInput())).toMatchObject({ ok: false });
    await expect(evaluateRequest(w.actors.officer, id, evaluationInput())).rejects.toThrow();

    const input = evaluationInput({ note: "ملاحظة المراجع" }, true);
    input.criteria[2] = { key: input.criteria[2].key, met: false, note: "لا يوجد مسؤول ميداني للموقع الثاني" };
    expect(await evaluateRequest(w.actors.supervisor, id, input)).toEqual({ ok: true });
    expect(await stageOf(id)).toBe("MANAGER");
    expect(await statusOf(id)).toBe("UNDER_REVIEW");
    const saved = await db.requestEvaluation.findFirstOrThrow({ where: { requestId: id } });
    expect(saved).toMatchObject({ note: "ملاحظة المراجع", reviewerId: w.users.supervisor.id });
    expect(saved.criteria).toEqual(expect.arrayContaining([{ key: input.criteria[2].key, met: false, note: "لا يوجد مسؤول ميداني للموقع الثاني" }]));
    expect(await db.notification.count({ where: { userId: w.users.manager.id, type: "request.evaluated" } })).toBe(1);

    // Sent: the supervisor can no longer evaluate, return, reject or move it.
    expect(await evaluateRequest(w.actors.supervisor, id, evaluationInput())).toMatchObject({ ok: false });
    const late = await decideRequests(w.actors.supervisor, [id], "return", "أرفقوا الخطة");
    expect(late.ok && late.outcome.skipped).toHaveLength(1);
    expect((await getRequestDetail(w.actors.supervisor, id))?.capabilities).toMatchObject({ canEvaluate: false, canDecide: false, canChangeScope: false });
  });
});

describe("the supervisor's recommendation (D-139)", () => {
  const RETURN_REASON = "ينقص الطلب خطة التنفيذ التفصيلية";

  it("needs a reason to return or reject, and the same criteria and signature as accepting", async () => {
    const { id } = await submittedRequest(w);
    const s = w.actors.supervisor;
    for (const recommendation of ["return", "reject"] as const) {
      expect(await evaluateRequest(s, id, evaluationInput({ recommendation, reason: "" }))).toMatchObject({ ok: false, errors: { reason: expect.any(String) } });
      expect(await evaluateRequest(s, id, evaluationInput({ recommendation, reason: RETURN_REASON, password: "wrong-password" }))).toMatchObject({ ok: false, errors: { password: expect.any(String) } });
      expect(await evaluateRequest(s, id, evaluationInput({ recommendation, reason: RETURN_REASON, criteria: evaluationInput().criteria.slice(1) }))).toMatchObject({ ok: false, errors: { criteria: expect.any(String) } });
    }
    expect(await db.requestEvaluation.count({ where: { requestId: id } })).toBe(0);
    expect(await stageOf(id)).toBe("SUPERVISOR");
  });

  it("moves to the unit manager, sealed, and the association sees nothing until the decision", async () => {
    const { id } = await submittedRequest(w);
    expect(await evaluateRequest(w.actors.supervisor, id, evaluationInput({ recommendation: "return", reason: RETURN_REASON }))).toEqual({ ok: true });

    expect(await statusOf(id)).toBe("UNDER_REVIEW");
    expect(await stageOf(id)).toBe("MANAGER");
    const saved = await db.requestEvaluation.findFirstOrThrow({ where: { requestId: id }, include: { seal: true } });
    expect(saved).toMatchObject({ recommendation: "RETURN", reason: RETURN_REASON });
    expect(JSON.parse(saved.seal!.payload)).toMatchObject({ kind: "EVALUATION", recommendation: "RETURN" });

    const officerView = await getRequestDetail(w.actors.officer, id);
    expect(officerView?.status.key).toBe("UNDER_REVIEW");
    expect(officerView?.review).toBeNull();
    expect(JSON.stringify(officerView)).not.toContain(RETURN_REASON);
    expect(await db.notification.count({ where: { userId: w.users.officer.id, type: { in: ["request.returned", "request.rejected", "request.approved"] } } })).toBe(0);

    const row = (await listRequests(w.actors.manager, parseRequestListParams({ stage: "manager" }, "scope"), "scope")).items[0];
    expect(row).toMatchObject({ id, recommendation: "return", approvable: true, decidable: true });
    const officerRow = (await listRequests(w.actors.officer, parseRequestListParams({}, "mine"), "mine")).items.find((r) => r.id === id);
    expect(officerRow?.recommendation).toBeNull();
    const managerView = await getRequestDetail(w.actors.manager, id);
    expect(managerView?.review?.evaluations.at(-1)).toMatchObject({ recommendation: "return", reason: RETURN_REASON });
  });

  it("shows the staff who did what in «سجل الطلب», and none of it to the association", async () => {
    const { id } = await submittedRequest(w);
    const holder = await holderOf(id);
    await evaluateRequest(holder, id, evaluationInput({ recommendation: "return", reason: RETURN_REASON, note: "ملاحظة المشرف" }));
    await approveRequests(w.actors.manager, [id], managerSignature());

    for (const staff of [w.actors.manager, holder]) {
      const view = await getRequestDetail(staff, id);
      expect(view?.review?.evaluations).toEqual([expect.objectContaining({ recommendation: "return", reason: RETURN_REASON, note: "ملاحظة المشرف" })]);
      expect(view?.review?.assignments).toEqual([expect.objectContaining({ actor: null, to: expect.any(String) })]);
      expect(view?.timeline.at(-1)).toMatchObject({ to: { key: "APPROVED" }, actorRole: "UNIT_MANAGER" });
    }
    const officerView = await getRequestDetail(w.actors.officer, id);
    expect(officerView?.review).toBeNull();
    expect(officerView?.timeline.every((t) => t.actorRole === null)).toBe(true);
  });

  it("lets the unit manager confirm a return, which only then reaches the association", async () => {
    const { id } = await submittedRequest(w);
    await evaluateRequest(w.actors.supervisor, id, evaluationInput({ recommendation: "return", reason: RETURN_REASON }));
    const r = await decideRequests(w.actors.manager, [id], "return", RETURN_REASON);
    expect(r.ok && r.outcome.done).toHaveLength(1);
    expect(await statusOf(id)).toBe("RETURNED");
    expect(await db.notification.count({ where: { userId: w.users.officer.id, type: "request.returned" } })).toBe(1);
    const entry = await db.auditLog.findFirstOrThrow({ where: { entityId: id, action: "request.returned" } });
    expect(entry.after).toMatchObject({ recommendation: "RETURN", reason: RETURN_REASON });
  });

  it("lets the unit manager overrule a return and accept, sealed, without the supervisor's reason", async () => {
    const { id } = await submittedRequest(w);
    await evaluateRequest(w.actors.supervisor, id, evaluationInput({ recommendation: "return", reason: RETURN_REASON }));
    const done = await approveRequests(w.actors.manager, [id], managerSignature());
    expect(done.ok && done.outcome.done).toHaveLength(1);
    expect(await statusOf(id)).toBe("APPROVED");
    expect(await db.notification.count({ where: { userId: w.users.officer.id, type: "request.approved" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: w.users.officer.id, type: "request.returned" } })).toBe(0);
    expect(await db.requestSeal.count({ where: { requestId: id, kind: "APPROVAL" } })).toBe(1);
    const officerView = await getRequestDetail(w.actors.officer, id);
    expect(JSON.stringify(officerView)).not.toContain(RETURN_REASON);
    expect(await db.requestStatusHistory.findFirstOrThrow({ where: { requestId: id, toStatus: { key: "APPROVED" } } })).toMatchObject({ note: null });
  });

  it("lets the unit manager overrule an acceptance and a rejection with another decision and reason", async () => {
    const accepted = await submittedRequest(w);
    await evaluateRequest(await holder(accepted.id), accepted.id, evaluationInput());
    const rejected = await decideRequests(w.actors.manager, [accepted.id], "reject", "لا يتوافق مع شروط المبادرة");
    expect(rejected.ok && rejected.outcome.done).toHaveLength(1);
    expect(await statusOf(accepted.id)).toBe("REJECTED");

    const refused = await submittedRequest(w);
    await evaluateRequest(await holder(refused.id), refused.id, evaluationInput({ recommendation: "reject", reason: "لا يستوفي الشروط" }));
    const returned = await decideRequests(w.actors.manager, [refused.id], "return", "استكملوا البيانات ثم أعيدوا التقديم");
    expect(returned.ok && returned.outcome.done).toHaveLength(1);
    expect(await statusOf(refused.id)).toBe("RETURNED");
  });

  it("makes the unit manager wait while another supervisor of the track is active", async () => {
    const { id } = await submittedRequest(w);
    const sup = (await db.request.findUniqueOrThrow({ where: { id } })).assignedSupervisorId!;
    await db.user.update({ where: { id: sup }, data: { isActive: false } });
    expect((await getRequestDetail(w.actors.manager, id))?.capabilities).toMatchObject({ canDecide: false, awaitsSupervisor: true });
  });

  it("lets the unit manager return or reject, not approve, when the track has no active supervisor", async () => {
    const { id } = await submittedRequest(w);
    await db.user.updateMany({ where: { id: { in: [w.users.supervisor.id, w.users.supervisor2.id] } }, data: { isActive: false } });
    expect((await getRequestDetail(w.actors.manager, id))?.capabilities).toMatchObject({ canDecide: true, canApprove: false, awaitsSupervisor: false });
    const early = await approveRequests(w.actors.manager, [id], managerSignature());
    expect(early.ok && early.outcome.skipped).toHaveLength(1);
    const r = await decideRequests(w.actors.manager, [id], "reject", "لا يوجد مشرف لهذا المسار");
    expect(r.ok && r.outcome.done).toHaveLength(1);
  });

  const holder = async (id: string) => {
    const sup = (await db.request.findUniqueOrThrow({ where: { id } })).assignedSupervisorId;
    return sup === w.users.supervisor2.id ? w.actors.supervisor2 : w.actors.supervisor;
  };
});

describe("the unit manager's decision", () => {
  it("approves only after the evaluation; the supervisor is told the outcome", async () => {
    const { id } = await submittedRequest(w);
    const early = await approveRequests(w.actors.manager, [id], managerSignature());
    expect(early.ok && early.outcome.skipped[0]?.reason).toMatch(/لم يرفع المشرف توصيته/);
    const earlyReturn = await decideRequests(w.actors.manager, [id], "return", "أرفقوا الخطة");
    expect(earlyReturn.ok && earlyReturn.outcome.skipped[0]?.reason).toMatch(/لم يرفع المشرف توصيته/);
    expect((await getRequestDetail(w.actors.manager, id))?.capabilities).toMatchObject({ canApprove: false, canDecide: false, awaitsSupervisor: true });

    await evaluateRequest(w.actors.supervisor, id, evaluationInput());
    expect((await getRequestDetail(w.actors.manager, id))?.capabilities).toMatchObject({ canApprove: true, canDecide: true, canChangeScope: true });
    const list = await listRequests(w.actors.manager, parseRequestListParams({ stage: "manager" }, "scope"), "scope");
    expect(list.items.map((r) => ({ id: r.id, approvable: r.approvable, withManager: r.withManager }))).toEqual([{ id, approvable: true, withManager: true }]);

    // The final approval is signed (D-117): never without the password, never with a wrong one.
    expect(await decideRequests(w.actors.manager, [id], "approve")).toMatchObject({ ok: false });
    expect(await approveRequests(w.actors.manager, [id], { ...managerSignature(), password: "wrong-password" })).toMatchObject({ ok: false, errors: { password: expect.any(String) } });
    expect(await approveRequests(w.actors.manager, [id], { password: "" })).toMatchObject({ ok: false, errors: { password: expect.any(String) } });
    expect(await approveRequests(w.actors.supervisor, [id], managerSignature())).toMatchObject({ ok: false });
    expect(await statusOf(id)).toBe("UNDER_REVIEW");
    const done = await approveRequests(w.actors.manager, [id], managerSignature());
    expect(done.ok && done.outcome.done).toHaveLength(1);
    expect(await db.requestApproval.findFirstOrThrow({ where: { requestId: id } })).toMatchObject({ managerId: w.users.manager.id });
    expect((await getRequestDetail(w.actors.manager, id))?.review?.approvals).toHaveLength(1);
    expect(await statusOf(id)).toBe("APPROVED");
    expect(await db.notification.count({ where: { userId: w.users.supervisor.id, type: "request.manager_decided" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: w.users.officer.id, type: "request.approved" } })).toBe(1);
  });

  it("a return goes to the association, and the resubmitted request starts with the supervisor again", async () => {
    const { id } = await submittedRequest(w);
    await evaluateRequest(w.actors.supervisor, id, evaluationInput());
    const returned = await decideRequests(w.actors.manager, [id], "return", "أرفقوا مصفوفة الصلاحيات");
    expect(returned.ok && returned.outcome.done).toHaveLength(1);
    expect(await stageOf(id)).toBe("SUPERVISOR");
    expect(await db.notification.count({ where: { userId: w.users.supervisor.id, type: "request.manager_decided" } })).toBe(1);
    expect((await saveDraft(w.actors.officer, id, validDraft({ title: "مشروع معدّل" }))).ok).toBe(true);
    expect((await submitRequest(w.actors.officer, id)).ok).toBe(true);
    expect((await getRequestDetail(w.actors.supervisor, id))?.capabilities.canEvaluate).toBe(true);
  });
});

describe("the unit manager edits the evaluation (D-120)", () => {
  it("only while it waits for them; the criteria and note change, the seal stays; recorded and the supervisor told", async () => {
    const { id } = await submittedRequest(w);
    const changed = evaluationInput().criteria.map((c, i) => (i === 0 ? { ...c, met: false, note: "يحتاج إلى توضيح" } : c));
    expect(await editEvaluation(w.actors.manager, id, { criteria: changed, note: "" })).toMatchObject({ ok: false }); // not evaluated yet
    await evaluateRequest(w.actors.supervisor, id, evaluationInput({ note: "ملاحظة المشرف" }));
    const signed = await db.requestSeal.findFirstOrThrow({ where: { requestId: id, kind: "EVALUATION" } });
    expect((await getRequestDetail(w.actors.manager, id))?.capabilities.canEditEvaluation).toBe(true);
    expect((await getRequestDetail(w.actors.supervisor, id))?.capabilities.canEditEvaluation).toBe(false);

    expect(await editEvaluation(w.actors.supervisor, id, { criteria: changed, note: "" })).toMatchObject({ ok: false });
    expect(await editEvaluation(w.actors.manager, id, { criteria: changed.slice(1), note: "" })).toMatchObject({ ok: false, errors: { criteria: expect.any(String) } });
    expect(await editEvaluation(w.actors.manager, id, { criteria: changed, note: "ملاحظة بعد التعديل" })).toEqual({ ok: true });

    const edited = await db.requestEvaluation.findFirstOrThrow({ where: { requestId: id } });
    expect(edited).toMatchObject({ note: "ملاحظة بعد التعديل", editedById: w.users.manager.id, reviewerId: w.users.supervisor.id });
    expect(await db.requestSeal.findFirstOrThrow({ where: { evaluationId: edited.id } })).toEqual(signed);
    expect(edited.criteria).toEqual(expect.arrayContaining([{ key: changed[0].key, met: false, note: "يحتاج إلى توضيح" }]));
    expect(await db.auditLog.count({ where: { action: "request.evaluation_edited", entityId: id } })).toBe(1);
    expect(await db.notification.count({ where: { userId: w.users.supervisor.id, type: "request.evaluation_edited" } })).toBe(1);
    expect((await getRequestDetail(w.actors.manager, id))?.review?.evaluations[0].edited).toMatchObject({ by: expect.any(String) });
    expect((await getRequestDetail(w.actors.officer, id))?.review).toBeNull();

    // Decided: no more edits.
    await approveRequests(w.actors.manager, [id], managerSignature());
    expect(await editEvaluation(w.actors.manager, id, { criteria: evaluationInput().criteria, note: "" })).toMatchObject({ ok: false });
  });
});

describe("programme and initiative changes", () => {
  it("the supervisor moves the request within their programmes; requirements follow, content stays", async () => {
    const { id } = await submittedRequest(w);
    const before = await db.request.findUniqueOrThrow({ where: { id } });
    expect(await changeRequestScope(w.actors.supervisor, id, { programId: w.p1.id, initiativeIds: [w.i2.id, w.i1.id], note: "المبادرة الثانية أدق" })).toEqual({ ok: true });
    const after = await db.request.findUniqueOrThrow({ where: { id }, include: { initiatives: { orderBy: { sortOrder: "asc" } } } });
    expect(after.initiatives.map((l) => l.initiativeId)).toEqual([w.i2.id, w.i1.id]);
    expect(after.initiativeId).toBe(w.i2.id);
    expect(after).toMatchObject({ title: before.title, description: before.description, statusId: before.statusId });
    expect(Array.isArray(after.requirementsSnapshot)).toBe(true);
    const change = await db.requestScopeChange.findFirstOrThrow({ where: { requestId: id } });
    expect(change).toMatchObject({ note: "المبادرة الثانية أدق", actorId: w.users.supervisor.id });
    expect(await db.auditLog.count({ where: { action: "request.scope_changed", entityId: id } })).toBe(1);

    expect(await changeRequestScope(w.actors.supervisor, id, { programId: w.p1.id, initiativeIds: [w.i2.id, w.i1.id] })).toMatchObject({ ok: false }); // unchanged
    expect(await changeRequestScope(w.actors.supervisor, id, { programId: w.p1.id, initiativeIds: [] })).toMatchObject({ ok: false, errors: { initiativeIds: expect.any(String) } });
    expect(await changeRequestScope(w.actors.supervisor, id, { programId: w.p1.id, initiativeIds: [w.iP2.id] })).toMatchObject({ ok: false });
    // A programme the assigned supervisor does not cover would take the request out of their scope.
    expect(await changeRequestScope(w.actors.manager, id, { programId: w.p2.id, initiativeIds: [w.iP2.id] })).toMatchObject({ ok: false, errors: { programId: expect.any(String) } });
    // Another supervisor of the track may change it, and the assigned one is told (D-144); another track may not.
    expect(await changeRequestScope(w.actors.supervisorP2, id, { programId: w.p1.id, initiativeIds: [w.i1.id] })).toMatchObject({ ok: false });
    expect(await changeRequestScope(w.actors.supervisor2, id, { programId: w.p1.id, initiativeIds: [w.i1.id] })).toEqual({ ok: true });
    expect(await db.notification.count({ where: { userId: w.users.supervisor.id, type: "request.scope_changed" } })).toBe(1);
  });

  it("the unit manager may change it while it waits for them; the supervisor is told", async () => {
    const { id } = await submittedRequest(w);
    await evaluateRequest(w.actors.supervisor, id, evaluationInput());
    expect(await changeRequestScope(w.actors.supervisor, id, { programId: w.p1.id, initiativeIds: [w.i2.id] })).toMatchObject({ ok: false });
    expect(await changeRequestScope(w.actors.manager, id, { programId: w.p1.id, initiativeIds: [w.i2.id] })).toEqual({ ok: true });
    expect(await db.notification.count({ where: { userId: w.users.supervisor.id, type: "request.scope_changed" } })).toBe(1);
    expect(await stageOf(id)).toBe("MANAGER");
  });
});

describe("the association sees none of it", () => {
  it("keeps «قيد المراجعة» and no review data until the request comes back", async () => {
    const { id } = await submittedRequest(w);
    await changeRequestScope(w.actors.supervisor, id, { programId: w.p1.id, initiativeIds: [w.i1.id, w.i2.id] });
    await evaluateRequest(w.actors.supervisor, id, evaluationInput());
    const officerView = await getRequestDetail(w.actors.officer, id);
    expect(officerView?.status.key).toBe("UNDER_REVIEW");
    expect(officerView?.review).toBeNull();
    expect(officerView?.capabilities).toMatchObject({ canEvaluate: false, canApprove: false, canChangeScope: false, canPrint: false });
    expect(officerView?.timeline.map((t) => t.to.key)).not.toContain("APPROVED");
    expect(await db.notification.count({ where: { userId: w.users.officer.id, type: { in: ["request.evaluated", "request.scope_changed", "request.manager_decided"] } } })).toBe(0);
    const staffView = await getRequestDetail(w.actors.manager, id);
    expect(staffView?.review).toMatchObject({ stage: "MANAGER", evaluations: [expect.objectContaining({ reviewer: expect.any(String) })], scopeChanges: [expect.any(Object)] });
  });
});

describe("the supervisor's «new request» banner and «ذات أولوية» tab (D-127)", () => {
  const unopened = (actor: RequestWorld["actors"]["supervisor"]) =>
    listRequests(actor, parseRequestListParams({ unopened: "1" }, "queue"), "queue").then((p) => p.items.map((r) => r.id));

  it("lists a submitted request until its own supervisor opens it, and again after reassignment", async () => {
    const { id } = await submittedRequest(w);
    const assigned = (await db.request.findUniqueOrThrow({ where: { id } })).assignedSupervisorId;
    const [mine, other] = assigned === w.users.supervisor2.id ? [w.actors.supervisor2, w.actors.supervisor] : [w.actors.supervisor, w.actors.supervisor2];
    expect(await unopened(mine)).toEqual([id]);
    expect(await unopened(other)).toEqual([]);

    // The unit manager or the super admin opening it does not clear it.
    await getRequestDetail(w.actors.manager, id);
    await getRequestDetail(w.actors.admin, id);
    expect(await unopened(mine)).toEqual([id]);

    await getRequestDetail(mine, id);
    expect(await unopened(mine)).toEqual([]);

    expect(await reassignRequests(w.actors.manager, [id], other.id, "إعادة توزيع")).toMatchObject({ ok: true });
    expect(await unopened(other)).toEqual([id]);
  });

  it("puts returned and overdue requests under «ذات أولوية»", async () => {
    const { id: returned } = await submittedRequest(w);
    const { id: overdue } = await submittedRequest(w);
    const { id: onTime } = await submittedRequest(w);
    const holder = async (id: string) => {
      const sup = (await db.request.findUniqueOrThrow({ where: { id } })).assignedSupervisorId;
      return sup === w.users.supervisor2.id ? w.actors.supervisor2 : w.actors.supervisor;
    };
    await decideThroughManager(w, returned, "return", "أرفقوا الخطة المحدثة", await holder(returned));
    await db.request.update({ where: { id: overdue }, data: { slaDueAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    const priority = async (actor: RequestWorld["actors"]["supervisor"]) =>
      (await listRequests(actor, parseRequestListParams({ priority: "1" }, "queue"), "queue")).items.map((r) => r.id);
    const ids = [...(await priority(w.actors.supervisor)), ...(await priority(w.actors.supervisor2))];
    expect(ids.sort()).toEqual([returned, overdue].sort());
    expect(ids).not.toContain(onTime);
  });

  it("leaves the draft and the completeness check out of the request history", async () => {
    const { id } = await submittedRequest(w);
    const detail = await getRequestDetail(w.actors.manager, id);
    expect(detail?.timeline.map((t) => t.to.key)).toEqual(["SUBMITTED", "UNDER_REVIEW"]);
  });
});
