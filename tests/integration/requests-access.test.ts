import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import { getOverview, getWorkload } from "@/server/services/dashboard";
import { assignmentOverview } from "@/server/services/requests/assignment";
import { attachOwnFile, canUploadTo, removeDraftAttachment, requestFile } from "@/server/services/requests/attachments";
import { addComment } from "@/server/services/requests/comments";
import { saveDraft } from "@/server/services/requests/drafts";
import { getRequestDetail, listRequests, parseRequestListParams, requestStatusCounts } from "@/server/services/requests/read";
import { submitRequest } from "@/server/services/requests/submit";
import { db, resetDatabase } from "../support/db";
import { FIXTURES } from "../support/files";
import { addVersion, attachPlan, evaluateAndApprove, makeRequestWorld, MIME, newDraft, stageFor, submittedRequest, validDraft, type RequestWorld } from "../support/requests";

const storageRoot = mkdtempSync(join(tmpdir(), "rifada-requests-access-"));
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

const params = (view: "mine" | "queue" | "scope", q: Record<string, string> = {}) => parseRequestListParams(q, view);
const staffRoles = ["admin", "manager", "supervisor"] as const;

describe("draft privacy (change 19)", () => {
  it("no staff role can read, list, count or download a draft, its files or completeness result", async () => {
    const draft = await newDraft(w);
    await saveDraft(w.actors.officer, draft, validDraft({ title: "مسودة سرية للجمعية", description: "" }));
    const attachmentId = await attachPlan(w.actors.officer, draft);
    expect((await submitRequest(w.actors.officer, draft)).ok).toBe(false); // a blocked check stays private too
    expect(await db.completenessCheck.count({ where: { requestId: draft } })).toBe(1);
    const versionId = (await db.attachmentVersion.findFirstOrThrow({ where: { attachmentId } })).id;

    for (const role of staffRoles) {
      const actor = w.actors[role];
      expect(await getRequestDetail(actor, draft), role).toBeNull();
      expect((await listRequests(actor, params("scope"), "scope")).total, role).toBe(0);
      expect((await requestStatusCounts(actor, "scope")).reduce((n, s) => n + s.count, 0), role).toBe(0);
      expect((await requestStatusCounts(actor, "scope")).some((s) => s.key === "DRAFT"), role).toBe(false);
      expect(await requestFile(actor, draft, versionId), role).toBeNull();
      expect(await canUploadTo(actor, draft, "comment"), role).toBe(false);
      const overview = await getOverview(actor);
      expect([overview.total, overview.drafts, overview.open], role).toEqual([0, 0, 0]);
      const search = await listRequests(actor, params("scope", { q: "مسودة سرية" }), "scope");
      expect(search.total, role).toBe(0);
    }
    expect((await assignmentOverview(w.actors.manager)).unassigned).toHaveLength(0);
    expect((await getWorkload()).every((row) => row.open === 0)).toBe(true);
    // Its own association sees it.
    expect((await getRequestDetail(w.actors.officer, draft))?.title).toBe("مسودة سرية للجمعية");
    expect((await listRequests(w.actors.officer, params("mine"), "mine")).total).toBe(1);
    expect(await requestFile(w.actors.officer, draft, versionId)).not.toBeNull();
    // Another association does not.
    expect(await getRequestDetail(w.actors.officer2, draft)).toBeNull();
    expect(await requestFile(w.actors.officer2, draft, versionId)).toBeNull();
    // No comments on drafts at all.
    expect(await addComment(w.actors.officer, draft, { body: "تعليق", internal: false })).toMatchObject({ ok: false });
  });

  it("staff see the request from its first submission on", async () => {
    const { id } = await submittedRequest(w);
    for (const role of staffRoles) expect(await getRequestDetail(w.actors[role], id), role).not.toBeNull();
    expect(await getRequestDetail(w.actors.supervisorP2, id)).toBeNull(); // other program
    expect(await getRequestDetail(w.actors.officer2, id)).toBeNull(); // other association
  });

  it("the association prints the request only once it is approved; staff print it at any stage (D-114)", async () => {
    const { id } = await submittedRequest(w);
    expect((await getRequestDetail(w.actors.officer, id))?.capabilities.canPrint).toBe(false);
    for (const role of staffRoles) expect((await getRequestDetail(w.actors[role], id))?.capabilities.canPrint, role).toBe(true);
    await evaluateAndApprove(w, id);
    expect((await getRequestDetail(w.actors.officer, id))?.capabilities.canPrint).toBe(true);
  });
});

describe("request lists and counts", () => {
  it("are limited to the role's scope and the supervisor's queue to its own open requests", async () => {
    const a = await submittedRequest(w); // supervisor
    const b = await submittedRequest(w); // supervisor2
    const c = await submittedRequest(w, w.actors.officer2, w.t2); // supervisorP2, association 2
    const ids = (page: { items: { id: string }[] }) => page.items.map((r) => r.id).sort();
    expect(ids(await listRequests(w.actors.manager, params("scope"), "scope"))).toEqual([a.id, b.id, c.id].sort());
    expect(ids(await listRequests(w.actors.admin, params("scope"), "scope"))).toEqual([a.id, b.id, c.id].sort());
    expect(ids(await listRequests(w.actors.supervisor, params("scope"), "scope"))).toEqual([a.id, b.id].sort());
    expect(ids(await listRequests(w.actors.supervisor, params("queue"), "queue"))).toEqual([a.id]);
    expect(ids(await listRequests(w.actors.supervisorP2, params("scope"), "scope"))).toEqual([c.id]);
    expect(ids(await listRequests(w.actors.officer, params("mine"), "mine"))).toEqual([a.id, b.id].sort());
    expect(ids(await listRequests(w.actors.officer2, params("mine"), "mine"))).toEqual([c.id]);
    // Row actions only where the viewer may decide.
    const sup = await listRequests(w.actors.supervisor, params("scope"), "scope");
    expect(Object.fromEntries(sup.items.map((r) => [r.id, r.decidable]))).toEqual({ [a.id]: true, [b.id]: false });
    expect((await listRequests(w.actors.admin, params("scope"), "scope")).items.every((r) => !r.decidable)).toBe(true);
    // Filters and search.
    expect(ids(await listRequests(w.actors.manager, params("scope", { track: w.t2.id }), "scope"))).toEqual([c.id]);
    expect(ids(await listRequests(w.actors.manager, params("scope", { supervisor: w.users.supervisor2.id }), "scope"))).toEqual([b.id]);
    expect(ids(await listRequests(w.actors.manager, params("scope", { q: "جمعية أخرى" }), "scope"))).toEqual([c.id]);
    const counts = await requestStatusCounts(w.actors.manager, "scope");
    expect(counts.find((s) => s.key === "UNDER_REVIEW")?.count).toBe(3);
  });
});

describe("internal notes never reach association officers", () => {
  const MARKER = "MARKER-INTERNAL-7f3a9c";

  it("through detail, lists, counts, notifications, downloads or replies", async () => {
    const { id } = await submittedRequest(w);
    const note = await addComment(w.actors.supervisor, id, {
      body: `ملاحظة للفريق ${MARKER}`,
      internal: true,
      uploadIds: [await stageFor(w.actors.supervisor, id, `${MARKER}.pdf`, FIXTURES.pdf(MARKER))],
    });
    expect(note.ok).toBe(true);
    const reply = await addComment(w.actors.manager, id, { body: `رد داخلي ${MARKER}`, internal: true, parentId: note.ok ? note.id : null });
    expect(reply.ok).toBe(true);
    const visible = await addComment(w.actors.supervisor, id, { body: "يرجى توضيح الفئة المستهدفة.", internal: false });
    expect(visible.ok).toBe(true);

    const officerDetail = await getRequestDetail(w.actors.officer, id);
    const serialized = JSON.stringify(officerDetail);
    expect(serialized).not.toContain(MARKER);
    expect(officerDetail?.comments.map((c) => c.body)).toEqual(["يرجى توضيح الفئة المستهدفة."]);
    expect(officerDetail?.comments.every((c) => !c.isInternal)).toBe(true);
    expect(JSON.stringify(await listRequests(w.actors.officer, params("mine"), "mine"))).not.toContain(MARKER);
    expect(JSON.stringify(await requestStatusCounts(w.actors.officer, "mine"))).not.toContain(MARKER);
    expect(JSON.stringify(await getOverview(w.actors.officer))).not.toContain(MARKER);
    const officerNotifications = await db.notification.findMany({ where: { userId: w.users.officer.id } });
    expect(JSON.stringify(officerNotifications)).not.toContain(MARKER);
    expect(officerNotifications.filter((n) => n.title.includes("داخلية"))).toHaveLength(0);

    const internalVersion = await db.attachmentVersion.findFirstOrThrow({ where: { fileName: `${MARKER}.pdf` } });
    expect(await requestFile(w.actors.officer, id, internalVersion.id)).toBeNull();
    expect(await requestFile(w.actors.supervisor, id, internalVersion.id)).not.toBeNull();
    expect(await requestFile(w.actors.supervisorP2, id, internalVersion.id)).toBeNull();

    // Staff see the notes, marked internal.
    const staff = await getRequestDetail(w.actors.supervisor2, id);
    expect(staff?.comments.filter((c) => c.isInternal)).toHaveLength(2);

    // An officer cannot write internal notes or reply publicly to one; staff cannot reply publicly to one either.
    await expect(addComment(w.actors.officer, id, { body: "x", internal: true })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await addComment(w.actors.officer, id, { body: "رد", internal: false, parentId: note.ok ? note.id : "" })).toMatchObject({ ok: false });
    expect(await addComment(w.actors.manager, id, { body: "رد علني", internal: false, parentId: note.ok ? note.id : "" })).toMatchObject({ ok: false });
  });

  it("comments are threaded in the data, immutable, and the super admin cannot write", async () => {
    const { id } = await submittedRequest(w);
    const first = await addComment(w.actors.supervisor, id, { body: "سؤال للجمعية", internal: false });
    const answer = await addComment(w.actors.officer, id, { body: "إجابة الجمعية", internal: false, parentId: first.ok ? first.id : null });
    expect(answer.ok).toBe(true);
    expect((await db.comment.findUniqueOrThrow({ where: { id: answer.ok ? answer.id : "" } })).parentId).toBe(first.ok ? first.id : null);
    await expect(addComment(w.actors.admin, id, { body: "x", internal: false })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await addComment(w.actors.supervisorP2, id, { body: "x", internal: false })).toMatchObject({ ok: false });
    expect(await addComment(w.actors.officer2, id, { body: "x", internal: false })).toMatchObject({ ok: false });
    // The supervisor got the officer's reply as a notification; nobody gets their own.
    expect(await db.notification.count({ where: { userId: w.users.supervisor.id, type: "comment.reply" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: w.users.officer.id, type: { in: ["comment.reply", "comment.created"] } } })).toBe(1);
  });
});

describe("attachments", () => {
  it("keep several files, each with versions; identical bytes are refused", async () => {
    const id = await newDraft(w);
    const first = await attachPlan(w.actors.officer, id, "a");
    const second = await attachPlan(w.actors.officer, id, "b");
    expect(first).not.toBe(second);
    expect((await addVersion(w.actors.officer, id, first, "a")).ok).toBe(false); // same bytes as current
    expect(await addVersion(w.actors.officer, id, first, "a2")).toEqual({ ok: true, version: 2 });
    const detail = await getRequestDetail(w.actors.officer, id);
    expect(detail?.otherFiles).toHaveLength(2);
    expect(detail?.otherFiles.find((f) => f.attachmentId === first)?.versions.map((v) => v.versionNo)).toEqual([2, 1]);
  });

  it("use staged uploads only by their uploader and only for the request they were staged for", async () => {
    const a = await newDraft(w);
    const b = await newDraft(w);
    const forA = await stageFor(w.actors.officer, a);
    expect((await attachOwnFile(w.actors.officer, b, forA)).ok).toBe(false);
    const other = await newDraft(w, w.actors.officer2);
    const theirs = await stageFor(w.actors.officer2, other);
    expect((await attachOwnFile(w.actors.officer, a, theirs)).ok).toBe(false);
    expect((await attachOwnFile(w.actors.officer, a, forA)).ok).toBe(true);
    expect((await attachOwnFile(w.actors.officer, a, forA)).ok).toBe(false); // used once
  });

  it("are uploaded only to the officer's own editable request; files leave only drafts", async () => {
    const draft = await newDraft(w);
    expect(await canUploadTo(w.actors.officer, draft, "request")).toBe(true);
    expect(await canUploadTo(w.actors.officer2, draft, "request")).toBe(false);
    for (const role of staffRoles) expect(await canUploadTo(w.actors[role], draft, "request")).toBe(false);
    const { id } = await submittedRequest(w);
    expect(await canUploadTo(w.actors.officer, id, "request")).toBe(false); // under review
    expect(await canUploadTo(w.actors.officer, id, "comment")).toBe(true);
    expect(await canUploadTo(w.actors.supervisor, id, "comment")).toBe(true);
    expect(await canUploadTo(w.actors.supervisorP2, id, "comment")).toBe(false);
    expect(await canUploadTo(w.actors.admin, id, "comment")).toBe(false);

    const fileId = await attachPlan(w.actors.officer, draft);
    expect(await removeDraftAttachment(w.actors.officer2, draft, fileId)).toMatchObject({ ok: false });
    expect(await removeDraftAttachment(w.actors.officer, draft, fileId)).toEqual({ ok: true });
    const submittedFile = (await db.attachment.findFirstOrThrow({ where: { requestId: id } })).id;
    expect(await removeDraftAttachment(w.actors.officer, id, submittedFile)).toMatchObject({ ok: false });
  });

  it("are downloaded only by people who may read the request", async () => {
    const { id } = await submittedRequest(w);
    const versionId = (await db.attachmentVersion.findFirstOrThrow({ where: { attachment: { requestId: id } } })).id;
    for (const actor of [w.actors.officer, w.actors.supervisor, w.actors.supervisor2, w.actors.manager, w.actors.admin] as Actor[]) {
      const file = await requestFile(actor, id, versionId);
      expect(file?.fileName).toBe("خطة.pdf");
      file?.stream.destroy();
    }
    for (const actor of [w.actors.officer2, w.actors.supervisorP2] as Actor[]) expect(await requestFile(actor, id, versionId)).toBeNull();
    expect(await requestFile(w.actors.manager, "other-request", versionId)).toBeNull();
  });

  it("respect the association's storage quota", async () => {
    await db.setting.create({ data: { key: "uploads.associationQuotaMb", value: 100 } });
    const id = await newDraft(w);
    const big = await db.attachment.create({ data: { ownerType: "REQUEST", requestId: id, title: "كبير", uploadedById: w.users.officer.id } });
    await db.attachmentVersion.create({
      data: {
        attachmentId: big.id,
        versionNo: 1,
        storageKey: "attachments/00000000000000000000000000000000",
        fileName: "كبير.pdf",
        mime: MIME.pdf,
        size: 100 * 1024 * 1024,
        sha256: "0".repeat(64),
        uploadedById: w.users.officer.id,
      },
    });
    const r = await attachOwnFile(w.actors.officer, id, await stageFor(w.actors.officer, id));
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toContain("حد التخزين");
  });
});

describe("super admin", () => {
  it("reads submitted requests read-only, and every view and download is audited", async () => {
    const { id } = await submittedRequest(w);
    const detail = await getRequestDetail(w.actors.admin, id);
    expect(detail?.capabilities).toMatchObject({ canDecide: false, canComment: false, canReassign: false, canEdit: false, showAuditTrail: true });
    const versionId = (await db.attachmentVersion.findFirstOrThrow({ where: { attachment: { requestId: id } } })).id;
    (await requestFile(w.actors.admin, id, versionId))?.stream.destroy();
    expect(await db.auditLog.count({ where: { entityId: id, action: "request.viewed_by_admin", actorId: w.users.admin.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: id, action: "request.file_downloaded_by_admin", actorId: w.users.admin.id } })).toBe(1);
    // The trail shows these entries to the manager and the admin, never to supervisors or officers.
    const manager = await getRequestDetail(w.actors.manager, id);
    expect(manager?.auditTrail?.map((e) => e.action)).toEqual(expect.arrayContaining(["request.viewed_by_admin", "request.file_downloaded_by_admin"]));
    expect((await getRequestDetail(w.actors.supervisor, id))?.auditTrail).toBeNull();
    expect((await getRequestDetail(w.actors.officer, id))?.auditTrail).toBeNull();
    // Other roles' views are not audited as admin views.
    expect(await db.auditLog.count({ where: { entityId: id, action: "request.viewed_by_admin" } })).toBe(1);
  });
});
