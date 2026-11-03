import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { markRequestNotificationsRead } from "@/server/services/notifications";
import { addComment } from "@/server/services/requests/comments";
import { decideRequests } from "@/server/services/requests/decisions";
import { saveDraft } from "@/server/services/requests/drafts";
import { getRequestDetail, listRequests, parseRequestListParams, requestStatusCounts } from "@/server/services/requests/read";
import { submitRequest } from "@/server/services/requests/submit";
import { db, resetDatabase } from "../support/db";
import { makeRequestWorld, submittedRequest, validDraft, type RequestWorld } from "../support/requests";

// Owner's review of 2026-11-03 (D-130): «جديد» on rows, notifications settled by acting,
// «بعد التعديل» for resubmitted requests, and searching a reference as shown on screen.

const storageRoot = mkdtempSync(join(tmpdir(), "rifada-owner-review-"));
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
const rowOf = async (actor: RequestWorld["actors"][keyof RequestWorld["actors"]], view: "mine" | "scope", id: string, q: Record<string, string> = {}) =>
  (await listRequests(actor, params(view, q), view)).items.find((r) => r.id === id);

describe("«جديد» on rows", () => {
  it("shows until the user opens the request, and again after the next action by someone else", async () => {
    const { id } = await submittedRequest(w);
    expect((await rowOf(w.actors.supervisor, "scope", id))?.isNew).toBe(true);
    // The officer sent it: not new to them.
    expect((await rowOf(w.actors.officer, "mine", id))?.isNew).toBe(false);

    await markRequestNotificationsRead(w.users.supervisor.id, id);
    expect((await rowOf(w.actors.supervisor, "scope", id))?.isNew).toBe(false);

    expect((await addComment(w.actors.supervisor, id, { body: "نرجو توضيح الميزانية", internal: false })).ok).toBe(true);
    expect((await rowOf(w.actors.supervisor, "scope", id))?.isNew).toBe(false);
    expect((await rowOf(w.actors.officer, "mine", id))?.isNew).toBe(true);
  });
});

describe("notifications settled by acting", () => {
  it("deletes the actor's notifications about a request when they act on it, wherever they act from", async () => {
    const { id } = await submittedRequest(w);
    const about = { userId: w.users.supervisor.id, requestId: id };
    expect(await db.notification.count({ where: about })).toBeGreaterThan(0);
    expect((await decideRequests(w.actors.supervisor, [id], "return", "أرفقوا الخطة المحدثة")).ok).toBe(true);
    expect(await db.notification.count({ where: about })).toBe(0);
    // The association is told, and keeps its notice until it acts.
    expect(await db.notification.count({ where: { userId: w.users.officer.id, requestId: id, type: "request.returned" } })).toBe(1);
  });
});

describe("«بعد التعديل»", () => {
  it("is what the unit sees for a request sent back after edits; the association still sees «قيد المراجعة»", async () => {
    const { id } = await submittedRequest(w);
    const first = await submittedRequest(w);
    await decideRequests(w.actors.supervisor, [id], "return", "يرجى التعديل");
    await saveDraft(w.actors.officer, id, validDraft({ title: "طلب بعد التعديل" }));
    expect((await submitRequest(w.actors.officer, id)).ok).toBe(true);

    expect((await rowOf(w.actors.supervisor, "scope", id))?.status).toMatchObject({ key: "RESUBMITTED", name: "بعد التعديل" });
    expect((await rowOf(w.actors.supervisor, "scope", first.id))?.status.key).toBe("UNDER_REVIEW");
    expect((await rowOf(w.actors.officer, "mine", id))?.status.key).toBe("UNDER_REVIEW");

    const resubmitted = await listRequests(w.actors.manager, params("scope", { status: "RESUBMITTED" }), "scope");
    expect(resubmitted.items.map((r) => r.id)).toEqual([id]);
    const underReview = await listRequests(w.actors.manager, params("scope", { status: "UNDER_REVIEW" }), "scope");
    expect(underReview.items.map((r) => r.id)).toEqual([first.id]);
    const counts = await requestStatusCounts(w.actors.manager, "scope");
    expect(counts.find((c) => c.key === "RESUBMITTED")?.count).toBe(1);
    expect(counts.find((c) => c.key === "UNDER_REVIEW")?.count).toBe(1);

    // Still reviewed and decided like any request under review.
    const detail = await getRequestDetail(w.actors.supervisor, id);
    expect(detail?.status.key).toBe("RESUBMITTED");
    expect(detail?.capabilities.canDecide).toBe(true);
  });
});

describe("search", () => {
  it("finds a reference typed or copied in Arabic-Indic digits with direction marks", async () => {
    const { id, referenceNo } = await submittedRequest(w);
    const shown = referenceNo!.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]).replace(/-/g, "‎-‎");
    expect(parseRequestListParams({ q: shown }, "scope").q).toBe(referenceNo);
    expect((await listRequests(w.actors.manager, params("scope", { q: shown }), "scope")).items.map((r) => r.id)).toEqual([id]);
  });
});
