import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { contentDigest, openSeal } from "@/server/seal/seal";
import { getRequestDetail } from "@/server/services/requests/read";
import { approveRequests, evaluateRequest } from "@/server/services/requests/review";
import { statusMap } from "@/server/services/requests/common";
import { verifyDocument } from "@/server/services/verification";
import { db, resetDatabase } from "../support/db";
import { evaluateAndApprove, evaluationInput, makeRequestWorld, managerSignature, submittedRequest, type RequestWorld } from "../support/requests";

// Electronic seals and document verification (D-122).

const storageRoot = mkdtempSync(join(tmpdir(), "rifada-document-seals-"));
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

async function approved() {
  const { id } = await submittedRequest(w);
  await evaluateAndApprove(w, id);
  const seal = await db.requestSeal.findFirstOrThrow({ where: { requestId: id, kind: "APPROVAL" } });
  return { id, code: seal.verifyCode! };
}

describe("sealing", () => {
  it("seals the supervisor's evaluation and the manager's approval, each with its own serial", async () => {
    const { id } = await submittedRequest(w);
    await evaluateRequest(w.actors.supervisor, id, evaluationInput());
    const evaluation = await db.requestSeal.findFirstOrThrow({ where: { requestId: id } });
    expect(evaluation).toMatchObject({ kind: "EVALUATION", signerId: w.users.supervisor.id, verifyCode: null });
    expect(evaluation.serial).toMatch(/^RFD-SIG-\d{4}-\d{6}$/);
    const statement = openSeal(evaluation);
    expect(statement).toMatchObject({ kind: "EVALUATION", requestId: id, signer: { id: w.users.supervisor.id, role: "SUPERVISOR" } });
    expect(statement?.content).toBe(await contentDigest(db, id));

    await approveRequests(w.actors.manager, [id], managerSignature());
    const approval = await db.requestSeal.findFirstOrThrow({ where: { requestId: id, kind: "APPROVAL" } });
    expect(approval.serial).not.toBe(evaluation.serial);
    expect(approval.verifyCode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(openSeal(approval)).toMatchObject({ kind: "APPROVAL", decision: "APPROVED", evaluationSeal: evaluation.serial, verifyCode: approval.verifyCode });
  });

  it("gives every request of a bulk approval its own seal and code", async () => {
    const a = await submittedRequest(w);
    const b = await submittedRequest(w);
    // Requests are shared between the programme's supervisors; each is evaluated by its own.
    for (const { id } of [a, b]) {
      const { assignedSupervisorId } = await db.request.findUniqueOrThrow({ where: { id }, select: { assignedSupervisorId: true } });
      const supervisor = assignedSupervisorId === w.users.supervisor.id ? w.actors.supervisor : w.actors.supervisor2;
      expect(await evaluateRequest(supervisor, id, evaluationInput())).toEqual({ ok: true });
    }
    const r = await approveRequests(w.actors.manager, [a.id, b.id], managerSignature());
    expect(r.ok && r.outcome.skipped).toEqual([]);
    expect(r.ok && r.outcome.done).toHaveLength(2);
    const seals = await db.requestSeal.findMany({ where: { kind: "APPROVAL" } });
    expect(new Set(seals.map((s) => s.verifyCode)).size).toBe(2);
    expect(new Set(seals.map((s) => s.requestId))).toEqual(new Set([a.id, b.id]));
  });

  it("puts the seals and the code on the approved document for every reader, the association included", async () => {
    const { id } = await submittedRequest(w);
    await evaluateRequest(w.actors.supervisor, id, evaluationInput());
    expect((await getRequestDetail(w.actors.manager, id))?.certificate).toBeNull();
    await approveRequests(w.actors.manager, [id], managerSignature());
    const officer = await getRequestDetail(w.actors.officer, id);
    expect(officer?.review).toBeNull();
    expect(officer?.certificate).toMatchObject({
      verifyCode: expect.any(String),
      signers: [
        { kind: "EVALUATION", name: w.users.supervisor.name },
        { kind: "APPROVAL", name: w.users.manager.name },
      ],
    });
  });
});

describe("verification", () => {
  it("confirms a valid document to anyone, with staff details only for staff; every check is audited", async () => {
    const { id, code } = await approved();
    const publicResult = await verifyDocument(code.toLowerCase().replace(/-/g, " "), null);
    expect(publicResult).toMatchObject({ state: "valid", code, association: expect.any(String), staff: null });
    expect(publicResult.state === "valid" && publicResult.signers.map((s) => s.kind)).toEqual(["EVALUATION", "APPROVAL"]);
    expect(await verifyDocument(`https://example.test/verify/${code}`, w.actors.officer)).toMatchObject({ state: "valid", staff: null });
    expect(await verifyDocument(code, w.actors.manager)).toMatchObject({ state: "valid", staff: { href: `/manager/requests/${id}` } });
    expect(await db.auditLog.count({ where: { action: "document.verified", entityId: id } })).toBe(3);
  });

  it("finds nothing for an unknown or malformed code", async () => {
    await approved();
    expect(await verifyDocument("0000-0000-0000", null)).toEqual({ state: "not_found" });
    expect(await verifyDocument("not a code", null)).toEqual({ state: "not_found" });
    expect(await db.auditLog.count({ where: { action: "document.verified", entityId: null } })).toBe(2);
  });

  it("refuses a document whose request changed after approval", async () => {
    const { id, code } = await approved();
    await db.request.update({ where: { id }, data: { title: "عنوان مختلف" } });
    expect(await verifyDocument(code, null)).toMatchObject({ state: "invalid", reason: "changed" });
  });

  it("refuses a document that is no longer approved", async () => {
    const { id, code } = await approved();
    const statuses = await statusMap();
    await db.request.update({ where: { id }, data: { statusId: statuses.RETURNED.id } });
    expect(await verifyDocument(code, null)).toMatchObject({ state: "invalid", reason: "superseded" });
  });

  it("refuses a seal altered in the database", async () => {
    const { code } = await approved();
    const seal = await db.requestSeal.findFirstOrThrow({ where: { verifyCode: code } });
    const forged = seal.payload.replace(w.users.manager.name, "اسم آخر");
    await db.requestSeal.update({ where: { id: seal.id }, data: { payload: forged } });
    expect(await verifyDocument(code, null)).toMatchObject({ state: "invalid", reason: "tampered" });

    // Even with a matching digest, the signature does not check without the server's key.
    const { createHash } = await import("node:crypto");
    await db.requestSeal.update({ where: { id: seal.id }, data: { digest: createHash("sha256").update(forged, "utf8").digest("hex") } });
    expect(await verifyDocument(code, null)).toMatchObject({ state: "invalid", reason: "tampered" });
  });
});
