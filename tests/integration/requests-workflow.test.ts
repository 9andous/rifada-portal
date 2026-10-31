import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hijriYear } from "@/lib/format";
import { addWorkingDays } from "@/lib/working-days";
import { ForbiddenError } from "@/server/authz/scope";
import { reassignRequests } from "@/server/services/requests/assignment";
import { createDraft, discardDraft, saveDraft } from "@/server/services/requests/drafts";
import { attachOwnFile, OWN_FILES_MAX } from "@/server/services/requests/attachments";
import { decideRequests } from "@/server/services/requests/decisions";
import { approveRequests, evaluateRequest } from "@/server/services/requests/review";
import { getRequestDetail } from "@/server/services/requests/read";
import { ALREADY_SUBMITTED, submitRequest } from "@/server/services/requests/submit";
import { makeUser } from "../support/admin";
import { db, resetDatabase } from "../support/db";
import { FIXTURES } from "../support/files";
import { attachPlan, evaluateAndApprove, evaluationInput, managerSignature, makeRequestWorld, MIME, newDraft, stageFor, submittedRequest, validDraft, type RequestWorld } from "../support/requests";

const storageRoot = mkdtempSync(join(tmpdir(), "rifada-requests-test-"));
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

const statusKey = async (id: string) => (await db.request.findUniqueOrThrow({ where: { id }, include: { status: true } })).status.key;

describe("drafts", () => {
  it("are created by an officer of an active association in an available track and request type only (D-123)", async () => {
    const id = await newDraft(w);
    expect(await statusKey(id)).toBe("DRAFT");
    const choice = { trackId: w.t1.id, requestTypeId: w.requestTypes[0].id, title: "مشروع" };
    for (const role of ["admin", "manager", "supervisor"] as const) {
      await expect(createDraft(w.actors[role], choice)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await createDraft(w.actors.officer, { ...choice, title: undefined })).toMatchObject({ ok: true }); // named on the next step
    expect(await createDraft(w.actors.officer, { ...choice, trackId: "" })).toMatchObject({ ok: false, errors: { trackId: expect.any(String) } });
    await db.track.update({ where: { id: w.t2.id }, data: { archivedAt: new Date() } });
    expect(await createDraft(w.actors.officer, { ...choice, trackId: w.t2.id })).toMatchObject({ ok: false, errors: { trackId: expect.any(String) } });
    await db.requestType.update({ where: { id: w.requestTypes[1].id }, data: { isActive: false } });
    expect(await createDraft(w.actors.officer, { ...choice, requestTypeId: w.requestTypes[1].id })).toMatchObject({ ok: false, errors: { requestTypeId: expect.any(String) } });
    await db.association.update({ where: { id: w.association.id }, data: { isActive: false } });
    expect(await createDraft(w.actors.officer, choice)).toMatchObject({ ok: false });
  });

  it("store the design's fields, with numbers in Arabic digits, and a new track or type (D-123)", async () => {
    const id = await newDraft(w);
    expect(await saveDraft(w.actors.officer, id, validDraft({ trackId: w.t2.id, requestTypeId: w.requestTypes[2].id, partners: "مجمع الملك فهد" }))).toEqual({ ok: true });
    const row = await db.request.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ trackId: w.t2.id, requestTypeId: w.requestTypes[2].id, expectedBeneficiaries: "المؤذنون الجدد\nطلاب العلم", estimatedBudget: 480000, partners: "مجمع الملك فهد", programId: null, initiativeId: null });
    // Empty keeps the choice; a figure that is not a whole number is refused.
    expect(await saveDraft(w.actors.officer, id, validDraft({ trackId: "", requestTypeId: "" }))).toEqual({ ok: true });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).trackId).toBe(w.t2.id);
    expect(await saveDraft(w.actors.officer, id, validDraft({ estimatedBudget: "نصف مليون" }))).toMatchObject({ ok: false, errors: { estimatedBudget: expect.any(String) } });
  });

  it("can be saved only by their own association", async () => {
    const id = await newDraft(w);
    expect(await saveDraft(w.actors.officer2, id, validDraft())).toMatchObject({ ok: false });
    await expect(saveDraft(w.actors.supervisor, id, validDraft())).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses malformed dates and over-long text with field errors", async () => {
    const id = await newDraft(w);
    const r = await saveDraft(w.actors.officer, id, validDraft({ startDate: "2099-02-30", title: "ع".repeat(201) }));
    expect(r.ok).toBe(false);
    expect(Object.keys(("errors" in r && r.errors) || {}).sort()).toEqual(["startDate", "title"]);
  });

  it("are deleted with their files only while never submitted", async () => {
    const id = await newDraft(w);
    await attachPlan(w.actors.officer, id);
    const keys = (await db.attachmentVersion.findMany({ select: { storageKey: true } })).map((v) => v.storageKey);
    expect(await discardDraft(w.actors.officer2, id)).toMatchObject({ ok: false });
    expect(await discardDraft(w.actors.officer, id)).toEqual({ ok: true });
    expect(await db.request.count()).toBe(0);
    expect(await db.attachmentVersion.count()).toBe(0);
    const { getStorage } = await import("@/server/storage/storage");
    for (const key of keys) await expect(getStorage().size(key)).rejects.toThrow();
    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "request.draft_discarded" } });
    expect(JSON.stringify(entry.before)).toContain("خطة.pdf");
    expect(JSON.stringify(entry.before)).not.toContain("attachments/");

    const submitted = await submittedRequest(w);
    expect(await discardDraft(w.actors.officer, submitted.id)).toMatchObject({ ok: false });
  });
});

describe("track and request type at submission (D-123)", () => {
  it("does not ask for measures or partners; an archived track blocks by name", async () => {
    const id = await newDraft(w);
    expect(await saveDraft(w.actors.officer, id, validDraft({ kpis: "", partners: "" }))).toEqual({ ok: true });
    await db.track.update({ where: { id: w.t1.id }, data: { archivedAt: new Date() } });
    const blocked = await submitRequest(w.actors.officer, id);
    expect(blocked).toMatchObject({ ok: false, missing: [expect.objectContaining({ code: "track_unavailable", field: "trackId" })] });
    await db.track.update({ where: { id: w.t1.id }, data: { archivedAt: null } });
    const sent = await submitRequest(w.actors.officer, id);
    expect(sent.ok).toBe(true);
    const row = await db.request.findUniqueOrThrow({ where: { id } });
    // Assigned to a supervisor of the track, with no programme until the supervisor sets one.
    expect([w.users.supervisor.id, w.users.supervisor2.id]).toContain(row.assignedSupervisorId);
    expect(row.programId).toBeNull();
  });

  it("show the staff the programmes of the track, and supervisors only their tracks' requests", async () => {
    const { id } = await submittedRequest(w);
    const detail = await getRequestDetail(w.actors.supervisor, id);
    expect(detail?.track?.id).toBe(w.t1.id);
    expect(detail?.trackPrograms.map((p) => p.id)).toEqual([w.p1.id]);
    expect(detail?.program).toBeNull();
    expect((await getRequestDetail(w.actors.officer, id))?.trackPrograms).toEqual([]);
    expect(await getRequestDetail(w.actors.supervisorP2, id)).toBeNull();
  });
});

describe("the association's own files (D-115)", () => {
  it("are attached to an editable request beyond the requirements, any allowed type, at most ten", async () => {
    const id = await newDraft(w);
    const r = await attachOwnFile(w.actors.officer, id, await stageFor(w.actors.officer, id, "صورة.png", FIXTURES.png(), MIME.png));
    expect(r.ok).toBe(true);
    const detail = await getRequestDetail(w.actors.officer, id);
    expect(detail?.otherFiles.map((f) => f.current?.fileName)).toEqual(["صورة.png"]);
    expect(await attachOwnFile(w.actors.officer2, id, await stageFor(w.actors.officer2, id))).toMatchObject({ ok: false });
    for (let n = 1; n < OWN_FILES_MAX; n++) expect((await attachOwnFile(w.actors.officer, id, await stageFor(w.actors.officer, id, `ملف ${n}.pdf`, FIXTURES.pdf(String(n))))).ok).toBe(true);
    expect(await attachOwnFile(w.actors.officer, id, await stageFor(w.actors.officer, id, "زائد.pdf", FIXTURES.pdf("extra")))).toMatchObject({ ok: false, errors: { file: expect.any(String) } });
  });

  it("are refused once the request is submitted, and staff see them with the request", async () => {
    const { id } = await submittedRequest(w);
    expect(await attachOwnFile(w.actors.officer, id, await stageFor(w.actors.officer, id))).toMatchObject({ ok: false });
    expect((await getRequestDetail(w.actors.supervisor, id))?.otherFiles).toHaveLength(1);
  });
});

describe("completeness check", () => {
  async function blocked(id: string) {
    const r = await submitRequest(w.actors.officer, id);
    expect(r.ok).toBe(false);
    return !r.ok && "missing" in r ? (r.missing ?? []) : [];
  }

  it("lists everything missing in Arabic, persists the result and leaves the draft a draft", async () => {
    const id = await newDraft(w);
    await saveDraft(w.actors.officer, id, validDraft({ title: "", description: "" }));
    const missing = await blocked(id);
    expect(missing.map((m) => [m.code, m.field])).toEqual([
      ["general_missing", "title"],
      ["general_missing", "description"],
    ]);
    for (const m of missing) expect(m.message).toMatch(/[؀-ۿ]/);
    expect(await statusKey(id)).toBe("DRAFT");
    const check = await db.completenessCheck.findFirstOrThrow({ where: { requestId: id } });
    expect(check).toMatchObject({ passed: false, ranBy: "RULES" });
    expect((await db.request.findUniqueOrThrow({ where: { id } })).referenceNo).toBeNull();
  });

  it("refuses, on saving, a start date in the past and an end date before the start (D-123)", async () => {
    const id = await newDraft(w);
    expect(await saveDraft(w.actors.officer, id, validDraft({ startDate: "2020-01-01", endDate: "2020-02-01" }))).toMatchObject({ ok: false, errors: { startDate: expect.any(String) } });
    expect(await saveDraft(w.actors.officer, id, validDraft({ startDate: "2099-03-01", endDate: "2099-02-01" }))).toMatchObject({ ok: false, errors: { endDate: expect.any(String) } });
  });

  it("blocks a start date that has passed since it was saved, and an implausibly long span", async () => {
    const id = await newDraft(w);
    await saveDraft(w.actors.officer, id, validDraft({ startDate: "2099-01-01", endDate: "2109-01-01" }));
    expect((await blocked(id)).map((m) => m.code)).toEqual(["span_too_long"]);
    await db.request.update({ where: { id }, data: { startDate: new Date("2020-01-01T00:00:00Z"), endDate: new Date("2020-02-01T00:00:00Z") } });
    expect((await blocked(id)).map((m) => m.code)).toEqual(["start_in_past"]);
  });

  it("blocks a paused request type and an inactive association", async () => {
    const id = await newDraft(w);
    await saveDraft(w.actors.officer, id, validDraft());
    await db.requestType.update({ where: { id: w.requestTypes[0].id }, data: { isActive: false } });
    expect((await blocked(id)).map((m) => m.code)).toEqual(["request_type_unavailable"]);
    await db.requestType.update({ where: { id: w.requestTypes[0].id }, data: { isActive: true } });
    await db.association.update({ where: { id: w.association.id }, data: { isActive: false } });
    expect((await blocked(id)).map((m) => m.code)).toEqual(["association_inactive"]);
  });

  it("no longer asks for initiative requirements (D-123)", async () => {
    const id = await newDraft(w);
    await saveDraft(w.actors.officer, id, validDraft());
    // The world's initiative 1 has required fields and a required file; none applies any more.
    expect((await submitRequest(w.actors.officer, id)).ok).toBe(true);
  });
});

describe("submission", () => {
  it("assigns the reference number, history, SLA, snapshot and supervisor in one step", async () => {
    const before = new Date();
    const { id, referenceNo } = await submittedRequest(w);
    expect(referenceNo).toBe(`RF-${hijriYear()}-00001`);
    const row = await db.request.findUniqueOrThrow({ where: { id }, include: { status: true } });
    expect(row.status.key).toBe("UNDER_REVIEW");
    expect(row.submittedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(row.slaDueAt!.toISOString()).toBe(addWorkingDays(row.submittedAt!, 3).toISOString());
    expect(Array.isArray(row.requirementsSnapshot)).toBe(true);
    expect(row.assignedSupervisorId).toBe(w.users.supervisor.id);
    const history = await db.requestStatusHistory.findMany({ where: { requestId: id }, orderBy: { createdAt: "asc" }, include: { fromStatus: true, toStatus: true } });
    expect(history.map((h) => `${h.fromStatus?.key ?? "-"}>${h.toStatus.key}`)).toEqual([
      "->DRAFT",
      "DRAFT>SUBMITTED",
      "SUBMITTED>COMPLETENESS_CHECK",
      "COMPLETENESS_CHECK>UNDER_REVIEW",
    ]);
    expect(history[2].actorId).toBeNull();
    expect(await db.completenessCheck.findFirst({ where: { requestId: id, passed: true, ranBy: "RULES" } })).not.toBeNull();
    expect(await db.referenceCounter.findUnique({ where: { hijriYear: hijriYear() } })).toMatchObject({ lastSeq: 1 });
  });
});

describe("references under concurrency", () => {
  it("never repeat when many requests are submitted at once", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const id = await newDraft(w);
      await saveDraft(w.actors.officer, id, validDraft());
      await attachPlan(w.actors.officer, id, `r${i}`);
      ids.push(id);
    }
    const results = await Promise.all(ids.map((id) => submitRequest(w.actors.officer, id)));
    const refs = results.map((r) => (r.ok ? r.referenceNo : null));
    expect(refs.every(Boolean)).toBe(true);
    expect(new Set(refs).size).toBe(6);
    expect(refs.map((r) => Number(r!.split("-")[2])).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("double-click safety", () => {
  it("submits once when submit is sent twice in parallel", async () => {
    const id = await newDraft(w);
    await saveDraft(w.actors.officer, id, validDraft());
    await attachPlan(w.actors.officer, id);
    const [a, b] = await Promise.all([submitRequest(w.actors.officer, id), submitRequest(w.actors.officer, id)]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect([a, b].find((r) => !r.ok)).toMatchObject({ message: ALREADY_SUBMITTED });
    expect(await db.requestStatusHistory.count({ where: { requestId: id } })).toBe(4);
    expect(await db.referenceCounter.findFirst()).toMatchObject({ lastSeq: 1 });
  });

  it("decides once when a decision is sent twice in parallel, even by two deciders", async () => {
    const { id } = await submittedRequest(w);
    const [a, b] = await Promise.all([
      decideRequests(w.actors.supervisor, [id], "return", "أرفقوا الخطة المحدثة"),
      decideRequests(w.actors.manager, [id], "reject", "لا يتوافق مع شروط المبادرة"),
    ]);
    const done = [a, b].flatMap((r) => (r.ok ? r.outcome.done : []));
    const skipped = [a, b].flatMap((r) => (r.ok ? r.outcome.skipped : []));
    expect(done).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(await db.requestStatusHistory.count({ where: { requestId: id, fromStatus: { key: "UNDER_REVIEW" } } })).toBe(1);
  });
});

describe("full lifecycle with return and resubmission", () => {
  it("returns, edits, resubmits to the same supervisor with a new SLA, then approves", async () => {
    const { id, referenceNo } = await submittedRequest(w);
    expect((await decideRequests(w.actors.supervisor, [id], "return", "")).ok).toBe(false); // reason required
    const returned = await decideRequests(w.actors.supervisor, [id], "return", "أرفقوا خطة البرنامج المحدثة");
    expect(returned.ok && returned.outcome.done.map((d) => d.id)).toEqual([id]);
    expect(await statusKey(id)).toBe("RETURNED");
    expect(await db.notification.count({ where: { userId: w.users.officer.id, type: "request.returned" } })).toBe(1);

    // Staff still see the returned request and the officer's edits as they are saved (D-078).
    await saveDraft(w.actors.officer, id, validDraft({ title: "دورة تأهيل المؤذنين — محدثة", startDate: "2099-01-05", endDate: "2099-03-01" }));
    const staffView = await getRequestDetail(w.actors.supervisor, id);
    expect(staffView?.title).toBe("دورة تأهيل المؤذنين — محدثة");
    expect(staffView?.capabilities.returnedNotice).toBe(true);
    expect(staffView?.capabilities.canDecide).toBe(false);

    // The «today or later» start date applies only to the first submission (D-078).
    const firstSla = (await db.request.findUniqueOrThrow({ where: { id } })).slaDueAt!;
    const resubmittedAt = new Date();
    const again = await submitRequest(w.actors.officer, id, resubmittedAt);
    expect(again).toEqual({ ok: true, referenceNo });
    const row = await db.request.findUniqueOrThrow({ where: { id } });
    expect(row.assignedSupervisorId).toBe(w.users.supervisor.id);
    expect(row.slaDueAt!.getTime()).toBeGreaterThanOrEqual(firstSla.getTime());
    expect(row.slaDueAt!.toISOString()).toBe(addWorkingDays(resubmittedAt, 3).toISOString());
    expect(row.submittedAt!.getTime()).toBeLessThan(resubmittedAt.getTime()); // first submission kept
    expect(await db.notification.count({ where: { userId: w.users.supervisor.id, type: "request.resubmitted" } })).toBe(1);

    await evaluateAndApprove(w, id);
    const final = await db.request.findUniqueOrThrow({ where: { id }, include: { status: true } });
    expect(final.status.key).toBe("APPROVED");
    expect(final.decidedAt).not.toBeNull();
    const keys = (
      await db.requestStatusHistory.findMany({ where: { requestId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { toStatus: true } })
    ).map((h) => h.toStatus.key);
    expect(keys).toEqual(["DRAFT", "SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW", "RETURNED", "SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW", "APPROVED"]);
    expect(
      await db.auditLog.count({ where: { entityId: id, action: { in: ["request.submitted", "request.returned", "request.resubmitted", "request.approved"] } } }),
    ).toBe(4);
    expect(await db.notification.count({ where: { userId: w.users.officer.id, type: "request.approved" } })).toBe(1);
  });

  it("gives a resubmitted request to another supervisor when the first is no longer active", async () => {
    const { id } = await submittedRequest(w);
    await decideRequests(w.actors.supervisor, [id], "return", "يرجى التعديل");
    await db.user.update({ where: { id: w.users.supervisor.id }, data: { isActive: false } });
    expect((await submitRequest(w.actors.officer, id)).ok).toBe(true);
    expect((await db.request.findUniqueOrThrow({ where: { id } })).assignedSupervisorId).toBe(w.users.supervisor2.id);
    expect(await db.assignmentHistory.count({ where: { requestId: id } })).toBe(2);
  });
});

describe("automatic assignment", () => {
  it("chooses the fewest open requests, then the least recently assigned, then the username", async () => {
    // Both p1 supervisors start at zero: «supervisor.N» sorts before «zz.supervisor».
    const a = await submittedRequest(w);
    expect((await db.request.findUniqueOrThrow({ where: { id: a.id } })).assignedSupervisorId).toBe(w.users.supervisor.id);
    // supervisor has 1 open, supervisor2 has 0.
    const b = await submittedRequest(w);
    expect((await db.request.findUniqueOrThrow({ where: { id: b.id } })).assignedSupervisorId).toBe(w.users.supervisor2.id);
    // 1 and 1: supervisor was assigned less recently.
    const c = await submittedRequest(w);
    expect((await db.request.findUniqueOrThrow({ where: { id: c.id } })).assignedSupervisorId).toBe(w.users.supervisor.id);
    // Decided requests no longer count as open: supervisor 0, supervisor2 1.
    await decideRequests(w.actors.supervisor, [a.id, c.id], "reject", "لا يستوفي الشروط");
    const d = await submittedRequest(w);
    expect((await db.request.findUniqueOrThrow({ where: { id: d.id } })).assignedSupervisorId).toBe(w.users.supervisor.id);
  });

  it("ignores inactive supervisors and leaves the request unassigned when nobody is available", async () => {
    await db.user.updateMany({ where: { id: { in: [w.users.supervisor.id, w.users.supervisor2.id] } }, data: { isActive: false } });
    const { id } = await submittedRequest(w);
    expect((await db.request.findUniqueOrThrow({ where: { id } })).assignedSupervisorId).toBeNull();
    expect(await db.notification.count({ where: { type: "request.unassigned", userId: { in: [w.users.manager.id, w.users.manager2.id] } } })).toBe(2);
    const entry = await db.auditLog.findFirst({ where: { entityId: id, action: "request.left_unassigned" } });
    expect(entry?.actorId).toBeNull();
    // Only the unit manager can decide an unassigned request (approval needs a supervisor's evaluation, D-116).
    const r = await decideRequests(w.actors.manager, [id], "return", "أرفقوا الخطة");
    expect(r.ok && r.outcome.done).toHaveLength(1);
  });
});

describe("reassignment", () => {
  it("is for the unit manager, needs a reason, an active supervisor of the program, and is recorded", async () => {
    const { id } = await submittedRequest(w);
    for (const role of ["admin", "supervisor", "officer"] as const) {
      await expect(reassignRequests(w.actors[role], [id], w.users.supervisor2.id, "إعادة توزيع")).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect((await reassignRequests(w.actors.manager, [id], w.users.supervisor2.id, "")).ok).toBe(false);
    const wrongProgram = await reassignRequests(w.actors.manager, [id], w.users.supervisorP2.id, "إعادة توزيع");
    expect(wrongProgram.ok && wrongProgram.outcome.skipped.map((s) => s.id)).toEqual([id]);

    const r = await reassignRequests(w.actors.manager, [id], w.users.supervisor2.id, "توزيع الأحمال");
    expect(r.ok && r.outcome.done.map((d) => d.id)).toEqual([id]);
    const history = await db.assignmentHistory.findMany({ where: { requestId: id }, orderBy: { createdAt: "asc" } });
    expect(history.at(-1)).toMatchObject({ fromUserId: w.users.supervisor.id, toUserId: w.users.supervisor2.id, actorId: w.users.manager.id, reason: "توزيع الأحمال" });
    expect(await db.notification.count({ where: { userId: w.users.supervisor2.id, type: "request.assigned" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: w.users.supervisor.id, type: "request.reassigned_away" } })).toBe(1);

    // The previous supervisor can no longer decide; the new one can.
    const old = await decideRequests(w.actors.supervisor, [id], "return", "أرفقوا الخطة");
    expect(old.ok && old.outcome.skipped).toHaveLength(1);
    const now = await decideRequests(w.actors.supervisor2, [id], "reject", "لا يستوفي الشروط");
    expect(now.ok && now.outcome.done).toHaveLength(1);

    // Decided requests are not reassigned; drafts are not visible at all.
    const done = await reassignRequests(w.actors.manager, [id], w.users.supervisor.id, "إعادة");
    expect(done.ok && done.outcome.skipped.map((s) => s.id)).toEqual([id]);
    const draft = await newDraft(w);
    const hidden = await reassignRequests(w.actors.manager, [draft], w.users.supervisor.id, "إعادة");
    expect(hidden.ok && hidden.outcome.skipped).toEqual([{ id: draft, referenceNo: null, title: null, reason: "الطلب غير متاح لك." }]);
  });
});

describe("bulk decisions", () => {
  it("decide in-scope requests under review, skip the rest, and record each one", async () => {
    const mine = await submittedRequest(w); // supervisor
    const theirs = await submittedRequest(w); // supervisor2
    const mine2 = await submittedRequest(w); // supervisor
    const otherProgram = await submittedRequest(w, w.actors.officer, w.t2); // supervisorP2
    const draft = await newDraft(w);
    await evaluateAndApprove(w, mine2.id); // no longer under review

    const r = await decideRequests(w.actors.supervisor, [mine.id, theirs.id, mine2.id, otherProgram.id, draft, "missing-id", mine.id], "reject", "لا يستوفي الشروط");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.outcome.done.map((d) => d.id)).toEqual([mine.id]);
    const skipped = Object.fromEntries(r.outcome.skipped.map((s) => [s.id, s]));
    expect(Object.keys(skipped).sort()).toEqual([theirs.id, mine2.id, otherProgram.id, draft, "missing-id"].sort());
    expect(skipped[theirs.id].reason).toMatch(/غير مسند إليك/);
    expect(skipped[mine2.id].reason).toMatch(/ليس قيد المراجعة/);
    for (const hidden of [otherProgram.id, draft, "missing-id"]) expect(skipped[hidden]).toMatchObject({ title: null, referenceNo: null });

    // The unit manager decides the rest in bulk; each request gets its own history and audit entry.
    const m = await decideRequests(w.actors.manager, [theirs.id, otherProgram.id], "return", "يرجى استكمال البيانات");
    expect(m.ok && m.outcome.done.map((d) => d.id).sort()).toEqual([theirs.id, otherProgram.id].sort());
    for (const id of [theirs.id, otherProgram.id]) {
      expect(await db.requestStatusHistory.count({ where: { requestId: id, toStatus: { key: "RETURNED" }, note: "يرجى استكمال البيانات" } })).toBe(1);
      expect(await db.auditLog.count({ where: { entityId: id, action: "request.returned", actorId: w.users.manager.id } })).toBe(1);
    }
  });

  it("refuse more requests than the bulk maximum, and roles that do not review", async () => {
    await db.setting.upsert({ where: { key: "bulk.maxItems" }, create: { key: "bulk.maxItems", value: 2 }, update: { value: 2 } });
    const ids = [(await submittedRequest(w)).id, (await submittedRequest(w)).id, (await submittedRequest(w)).id];
    expect(await decideRequests(w.actors.manager, ids, "approve")).toMatchObject({ ok: false });
    expect(await reassignRequests(w.actors.manager, ids, w.users.supervisor2.id, "توزيع")).toMatchObject({ ok: false });
    expect(await db.request.count({ where: { status: { key: "APPROVED" } } })).toBe(0);
    for (const role of ["admin", "officer"] as const) {
      await expect(decideRequests(w.actors[role], ids.slice(0, 1), "approve")).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("respect the lifecycle data: a removed transition refuses the decision", async () => {
    const { id } = await submittedRequest(w);
    await evaluateRequest(w.actors.supervisor, id, evaluationInput());
    await db.statusTransition.deleteMany({ where: { fromStatus: { key: "UNDER_REVIEW" }, toStatus: { key: "APPROVED" } } });
    const r = await approveRequests(w.actors.manager, [id], managerSignature());
    expect(r.ok && r.outcome.skipped[0].reason).toMatch(/دورة حياة الطلب/);
  });

  it("let no supervisor outside the assignment decide", async () => {
    const stray = await makeUser("SUPERVISOR");
    const { id } = await submittedRequest(w);
    const r = await decideRequests({ id: stray.id, role: "SUPERVISOR", associationId: null, trackIds: [] }, [id], "approve");
    expect(r.ok && r.outcome.skipped).toHaveLength(1);
  });
});
