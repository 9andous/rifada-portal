// Phase 3 audit entries: every request mutation is audited, and no entry carries storage keys,
// comment text, passwords or tokens.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { reassignRequests } from "@/server/services/requests/assignment";
import { addComment } from "@/server/services/requests/comments";
import { decideRequests } from "@/server/services/requests/decisions";
import { discardDraft } from "@/server/services/requests/drafts";
import { getRequestDetail } from "@/server/services/requests/read";
import { TEST_PASSWORD } from "../support/admin";
import { db, resetDatabase } from "../support/db";
import { addVersion, attachPlan, makeRequestWorld, newDraft, submittedRequest, type RequestWorld } from "../support/requests";

const storageRoot = mkdtempSync(join(tmpdir(), "rifada-requests-audit-"));
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

describe("request audit entries", () => {
  it("record every change without keys, comment text or secrets", async () => {
    const SECRET_TEXT = "نص-تعليق-لا-يدخل-السجل-91";
    const { id } = await submittedRequest(w);
    await addComment(w.actors.supervisor, id, { body: SECRET_TEXT, internal: true });
    await addComment(w.actors.supervisor, id, { body: `${SECRET_TEXT}-علني`, internal: false });
    await decideRequests(w.actors.supervisor, [id], "return", "يرجى التعديل");
    const file = (await db.attachment.findFirstOrThrow({ where: { requestId: id } })).id;
    expect((await addVersion(w.actors.officer, id, file, "v2")).ok).toBe(true);
    await reassignRequests(w.actors.manager, [id], w.users.supervisor2.id, "توزيع");
    await getRequestDetail(w.actors.admin, id);
    const draft = await newDraft(w);
    await attachPlan(w.actors.officer, draft);
    await discardDraft(w.actors.officer, draft);

    const rows = await db.auditLog.findMany({ where: { entityType: "Request" } });
    const actions = new Set(rows.map((r) => r.action));
    for (const a of [
      "request.created",
      "request.saved",
      "request.file_added",
      "request.submitted",
      "request.auto_assigned",
      "request.internal_note_added",
      "request.comment_added",
      "request.returned",
      "request.file_version_added",
      "request.reassigned",
      "request.viewed_by_admin",
      "request.draft_discarded",
    ]) {
      expect(actions.has(a), a).toBe(true);
    }
    const all = JSON.stringify(rows);
    expect(all).not.toContain(SECRET_TEXT);
    expect(all).not.toMatch(/attachments\/[a-f0-9]{32}|staging\/[a-f0-9]{32}/);
    expect(all).not.toContain(TEST_PASSWORD);
    expect(all).not.toMatch(/\$argon2/);
  });
});
