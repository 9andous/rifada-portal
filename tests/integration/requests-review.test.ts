import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { decideRequests } from "@/server/services/requests/decisions";
import { getRequestDetail, listRequests, parseRequestListParams } from "@/server/services/requests/read";
import { approveRequests, changeRequestScope, editEvaluation, evaluateRequest } from "@/server/services/requests/review";
import { submitRequest } from "@/server/services/requests/submit";
import { saveDraft } from "@/server/services/requests/drafts";
import { db, resetDatabase } from "../support/db";
import { evaluationInput, makeRequestWorld, managerSignature, submittedRequest, validDraft, type RequestWorld } from "../support/requests";

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

describe("«تقييم واعتماد» by the supervisor", () => {
  it("replaces the supervisor's direct approval; return and reject stay", async () => {
    const { id } = await submittedRequest(w);
    const r = await decideRequests(w.actors.supervisor, [id], "approve");
    expect(r.ok && r.outcome.skipped[0]?.reason).toMatch(/تقييم واعتماد/);
    expect(await statusOf(id)).toBe("UNDER_REVIEW");
    const detail = await getRequestDetail(w.actors.supervisor, id);
    expect(detail?.capabilities).toMatchObject({ canEvaluate: true, canApprove: false, canDecide: true, canChangeScope: true });
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

  it("only the assigned supervisor evaluates, once; the request goes to the unit manager", async () => {
    const { id } = await submittedRequest(w);
    expect(await evaluateRequest(w.actors.supervisor2, id, evaluationInput())).toMatchObject({ ok: false });
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

describe("the unit manager's decision", () => {
  it("approves only after the evaluation; the supervisor is told the outcome", async () => {
    const { id } = await submittedRequest(w);
    const early = await approveRequests(w.actors.manager, [id], managerSignature());
    expect(early.ok && early.outcome.skipped[0]?.reason).toMatch(/لم يقيّم/);
    expect((await getRequestDetail(w.actors.manager, id))?.capabilities).toMatchObject({ canApprove: false, canDecide: true });

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
    expect(await changeRequestScope(w.actors.supervisor2, id, { programId: w.p1.id, initiativeIds: [w.i1.id] })).toMatchObject({ ok: false });
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
