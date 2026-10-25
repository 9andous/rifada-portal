// Phase 3 server actions for every role (pattern of stop2-actions.test.ts): the session is mocked,
// the services and the database are real.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/server/auth/session";
import type { Actor } from "@/server/authz/scope";
import { db, resetDatabase } from "../support/db";
import { attachPlan, makeRequestWorld, newDraft, stageFor, submittedRequest, validDraft, type RequestWorld } from "../support/requests";

const session = vi.hoisted(() => ({ current: null as CurrentUser | null }));
vi.mock("@/server/auth/session", () => ({
  requireUser: vi.fn(async () => {
    if (!session.current) throw new Error("NEXT_REDIRECT /login");
    return session.current;
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const a = await import("@/server/actions/requests");
const { FORBIDDEN_MESSAGE } = await import("@/server/actions/admin/state");

const storageRoot = mkdtempSync(join(tmpdir(), "rifada-requests-actions-"));
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
  session.current = null;
});

function signIn(actor: Actor) {
  session.current = { ...actor, name: "مستخدم", username: "u", email: "u@example.org", mustChangePassword: false, associationName: null };
}

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.append(k, v);
  return fd;
}

const draftForm = (overrides: Record<string, unknown> = {}) => {
  const d = validDraft(overrides);
  const fd = form({ title: d.title as string, description: d.description as string, targetAudience: d.targetAudience as string, location: d.location as string, startDate: d.startDate as string, endDate: d.endDate as string });
  for (const [k, v] of Object.entries(d.custom as Record<string, string>)) fd.append(`custom.${k}`, v);
  return fd;
};

describe("officer actions", () => {
  it("create, save and submit; a blocked submission returns the precise list", async () => {
    signIn(w.actors.officer);
    const created = await a.createDraftAction({}, form({ programId: w.p1.id, initiativeId: w.i1.id }));
    expect(created.ok).toBe(true);
    const id = created.createdId!;
    expect(await a.saveDraftAction(id, {}, draftForm())).toMatchObject({ ok: true });
    const blocked = await a.submitRequestAction(id, {}, draftForm());
    expect(blocked.ok).toBe(false);
    expect(blocked.missing?.map((m) => m.field)).toEqual(["attachment.program_plan"]);
    expect(await a.attachFileAction(id, "program_plan", await stageFor(w.actors.officer, id))).toEqual({ ok: true });
    const done = await a.submitRequestAction(id, {}, draftForm());
    expect(done).toMatchObject({ ok: true });
    expect(done.referenceNo).toMatch(/^RF-\d{4}-00001$/);
    expect(await a.submitRequestAction(id, {}, draftForm())).toMatchObject({ ok: false });
  });

  it("are refused to staff and to another association", async () => {
    const id = await newDraft(w);
    for (const actor of [w.actors.admin, w.actors.manager, w.actors.supervisor]) {
      signIn(actor);
      expect(await a.createDraftAction({}, form({ programId: w.p1.id, initiativeId: w.i1.id }))).toMatchObject({ ok: false, message: FORBIDDEN_MESSAGE });
      expect(await a.saveDraftAction(id, {}, draftForm())).toMatchObject({ ok: false, message: FORBIDDEN_MESSAGE });
      expect(await a.submitRequestAction(id, {}, draftForm())).toMatchObject({ ok: false, message: FORBIDDEN_MESSAGE });
      expect(await a.discardDraftAction(id)).toMatchObject({ ok: false, message: FORBIDDEN_MESSAGE });
    }
    signIn(w.actors.officer2);
    expect((await a.saveDraftAction(id, {}, draftForm())).ok).toBe(false);
    expect((await a.discardDraftAction(id)).ok).toBe(false);
    expect((await a.removeFileAction(id, "c".repeat(25))).ok).toBe(false);
    expect(await db.request.findUniqueOrThrow({ where: { id } })).toMatchObject({ title: "" });
  });

  it("refuse malformed ids before reaching the services", async () => {
    signIn(w.actors.officer);
    expect((await a.saveDraftAction("../x", {}, draftForm())).ok).toBe(false);
    expect((await a.attachFileAction("c".repeat(25), "Bad-Key", "f".repeat(32))).ok).toBe(false);
    expect((await a.decideAction(["../x"], "approve", ""))).toMatchObject({ ok: false });
  });

  it("discard a never-submitted draft", async () => {
    const id = await newDraft(w);
    await attachPlan(w.actors.officer, id);
    signIn(w.actors.officer);
    expect(await a.discardDraftAction(id)).toEqual({ ok: true });
    expect(await db.request.count()).toBe(0);
  });
});

describe("review actions", () => {
  it("let the assigned supervisor and the unit manager decide; others are refused or skipped", async () => {
    const r1 = await submittedRequest(w);
    const r2 = await submittedRequest(w); // supervisor2
    for (const actor of [w.actors.officer, w.actors.admin]) {
      signIn(actor);
      expect(await a.decideAction([r1.id], "approve", "")).toMatchObject({ ok: false, message: FORBIDDEN_MESSAGE });
      expect(await a.reassignAction([r1.id], w.users.supervisor2.id, "سبب")).toMatchObject({ ok: false, message: FORBIDDEN_MESSAGE });
    }
    signIn(w.actors.supervisor);
    expect(await a.reassignAction([r1.id], w.users.supervisor2.id, "سبب")).toMatchObject({ ok: false, message: FORBIDDEN_MESSAGE });
    const sup = await a.decideAction([r1.id, r2.id], "return", "يرجى التعديل");
    expect(sup.outcome?.done.map((d) => d.id)).toEqual([r1.id]);
    expect(sup.outcome?.skipped.map((s) => s.id)).toEqual([r2.id]);
    signIn(w.actors.manager);
    const mgr = await a.reassignAction([r2.id], w.users.supervisor.id, "توزيع");
    expect(mgr.outcome?.done.map((d) => d.id)).toEqual([r2.id]);
    expect((await a.decideAction([r2.id], "reject", ""))).toMatchObject({ ok: false }); // reason required
    expect((await a.decideAction([r2.id], "reject", "لا يستوفي")).outcome?.done).toHaveLength(1);
  });
});

describe("comment actions", () => {
  it("officers comment publicly only; staff write internal notes; the super admin cannot comment", async () => {
    const { id } = await submittedRequest(w);
    signIn(w.actors.officer);
    expect(await a.addCommentAction(id, {}, form({ body: "استفسار من الجمعية" }))).toMatchObject({ ok: true });
    expect(await a.addCommentAction(id, {}, form({ body: "داخلي", internal: "on" }))).toMatchObject({ ok: false, message: FORBIDDEN_MESSAGE });
    signIn(w.actors.supervisor);
    const note = await a.addCommentAction(id, {}, form({ body: "ملاحظة للفريق", internal: "on", uploadId: await stageFor(w.actors.supervisor, id) }));
    expect(note).toMatchObject({ ok: true });
    signIn(w.actors.admin);
    expect(await a.addCommentAction(id, {}, form({ body: "x" }))).toMatchObject({ ok: false, message: FORBIDDEN_MESSAGE });
    signIn(w.actors.officer2);
    expect((await a.addCommentAction(id, {}, form({ body: "x" }))).ok).toBe(false);
    expect(await db.comment.count({ where: { requestId: id } })).toBe(2);
    expect(await db.comment.count({ where: { requestId: id, isInternal: true } })).toBe(1);
  });
});
