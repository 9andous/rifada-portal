import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify, type KeyObject } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { hijriYear } from "@/lib/format";
import { CODE_ALPHABET, CODE_LENGTH, formatVerifyCode } from "@/lib/verify-code";

// Electronic seals (D-122). Each signing (the supervisor's evaluation, the unit manager's approval)
// becomes a statement in canonical JSON: who signed, when, and the SHA-256 fingerprint of the
// request's content and of the evaluation. The statement is signed with the server's Ed25519 key
// (SEAL_PRIVATE_KEY in .env) and stored with its serial number. An approval seal also carries the
// verification code printed under the document's QR code.
//
// No `server-only` import: the backfill script (scripts/seal-existing.ts) runs this module under
// tsx. It reads a secret from the environment, so it must never be imported by client code.

type Client = PrismaClient | Prisma.TransactionClient;

/** 2 (D-123): the content fingerprint also covers the track, the request type and the new fields. */
export const SEAL_VERSION = 2;

// ---------------------------------------------------------------------------
// Canonical JSON and hashing
// ---------------------------------------------------------------------------

/** JSON with object keys sorted at every depth and undefined members left out: one text per value. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map((v) => canonical(v === undefined ? null : v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

// ---------------------------------------------------------------------------
// The server's key
// ---------------------------------------------------------------------------

type SealKey = { privateKey: KeyObject; publicKey: KeyObject; keyId: string };
let cached: { raw: string; key: SealKey } | null = null;

/** The Ed25519 key from SEAL_PRIVATE_KEY (base64 PKCS#8 DER); keyId is the public key's fingerprint. */
export function sealKey(): SealKey {
  const raw = process.env.SEAL_PRIVATE_KEY?.trim();
  if (!raw) throw new Error("SEAL_PRIVATE_KEY is not set: generate one with `npm run seal:keygen` (see .env.example).");
  if (cached?.raw === raw) return cached.key;
  const privateKey = createPrivateKey({ key: Buffer.from(raw, "base64"), format: "der", type: "pkcs8" });
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("SEAL_PRIVATE_KEY must be an Ed25519 key.");
  const publicKey = createPublicKey(privateKey);
  const keyId = createHash("sha256").update(publicKey.export({ format: "der", type: "spki" })).digest("hex").slice(0, 16);
  cached = { raw, key: { privateKey, publicKey, keyId } };
  return cached.key;
}

// ---------------------------------------------------------------------------
// Verification codes and serial numbers
// ---------------------------------------------------------------------------

/** A random verification code (60 bits), shown as XXXX-XXXX-XXXX. */
export function newVerifyCode(): string {
  return formatVerifyCode(Array.from(randomBytes(CODE_LENGTH), (b) => CODE_ALPHABET[b & 31]).join(""));
}

/** Next RFD-SIG-<hijriYear>-<seq>: one atomic upsert on the year's counter row. */
async function nextSerial(tx: Client, at: Date): Promise<string> {
  const year = hijriYear(at);
  const rows = await tx.$queryRaw<{ lastSeq: number }[]>`
    INSERT INTO "seal_counters" ("hijriYear", "lastSeq") VALUES (${year}, 1)
    ON CONFLICT ("hijriYear") DO UPDATE SET "lastSeq" = "seal_counters"."lastSeq" + 1
    RETURNING "lastSeq"`;
  return `RFD-SIG-${year}-${String(Number(rows[0].lastSeq)).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// Fingerprints
// ---------------------------------------------------------------------------

/**
 * The fingerprint of what the association submitted and the unit placed it under: the content, the
 * programme and initiatives, and each file's current version with its SHA-256. Ids, not names, so a
 * renamed programme or association leaves a sealed document valid; any change to the request does not.
 * `version` is the seal's: seals made before D-123 (version 1) are checked against what they covered.
 */
export async function contentDigest(client: Client, requestId: string, version: number = SEAL_VERSION): Promise<string> {
  const r = await client.request.findUniqueOrThrow({
    where: { id: requestId },
    select: {
      referenceNo: true,
      associationId: true,
      programId: true,
      title: true,
      description: true,
      targetAudience: true,
      goals: true,
      location: true,
      startDate: true,
      endDate: true,
      trackId: true,
      requestTypeId: true,
      expectedBeneficiaries: true,
      estimatedBudget: true,
      kpis: true,
      partners: true,
      customFields: true,
      initiatives: { orderBy: [{ sortOrder: "asc" }, { initiativeId: "asc" }], select: { initiativeId: true } },
      attachments: { where: { ownerType: "REQUEST" }, select: { id: true, currentVersion: { select: { id: true, sha256: true } } } },
    },
  });
  const files = r.attachments
    .map((a) => ({ id: a.id, version: a.currentVersion?.id ?? null, sha256: a.currentVersion?.sha256 ?? null }))
    .sort((x, y) => (x.id < y.id ? -1 : 1));
  return sha256(
    canonical({
      referenceNo: r.referenceNo,
      associationId: r.associationId,
      programId: r.programId,
      initiativeIds: r.initiatives.map((l) => l.initiativeId),
      title: r.title,
      description: r.description,
      targetAudience: r.targetAudience,
      goals: r.goals,
      location: r.location,
      startDate: r.startDate,
      endDate: r.endDate,
      customFields: r.customFields,
      files,
      ...(version >= 2
        ? {
            trackId: r.trackId,
            requestTypeId: r.requestTypeId,
            expectedBeneficiaries: r.expectedBeneficiaries,
            estimatedBudget: r.estimatedBudget,
            kpis: r.kpis,
            partners: r.partners,
          }
        : {}),
    }),
  );
}

/** The fingerprint of an evaluation's criteria and note (not of who changed it). */
export const evaluationDigest = (e: { criteria: unknown; note: string | null }) => sha256(canonical({ criteria: e.criteria, note: e.note }));

// ---------------------------------------------------------------------------
// Sealing
// ---------------------------------------------------------------------------

export type SealStatement = {
  v: number;
  kind: "EVALUATION" | "APPROVAL";
  serial: string;
  requestId: string;
  referenceNo: string | null;
  signer: { id: string; name: string; role: string };
  signedAt: string;
  content: string;
  evaluation: string;
  /** APPROVAL: the serial of the supervisor's seal the manager approved. */
  evaluationSeal?: string;
  decision?: "APPROVED";
  verifyCode?: string;
};

type SealInput =
  | { kind: "EVALUATION"; requestId: string; signerId: string; evaluationId: string; at: Date }
  | { kind: "APPROVAL"; requestId: string; signerId: string; approvalId: string; at: Date };

/**
 * Seals a signing inside the caller's transaction. An approval seals the latest evaluation as it
 * stands (after any change by the unit manager, D-120) and gets the document's verification code.
 */
export async function createSeal(tx: Client, input: SealInput) {
  const key = sealKey();
  const [request, signer, content] = await Promise.all([
    tx.request.findUniqueOrThrow({ where: { id: input.requestId }, select: { referenceNo: true } }),
    tx.user.findUniqueOrThrow({ where: { id: input.signerId }, select: { id: true, name: true, role: true } }),
    contentDigest(tx, input.requestId),
  ]);
  const evaluation =
    input.kind === "EVALUATION"
      ? await tx.requestEvaluation.findUniqueOrThrow({ where: { id: input.evaluationId }, select: { criteria: true, note: true, seal: { select: { serial: true } } } })
      : await tx.requestEvaluation.findFirstOrThrow({
          where: { requestId: input.requestId, createdAt: { lte: input.at } },
          orderBy: { createdAt: "desc" },
          select: { criteria: true, note: true, seal: { select: { serial: true } } },
        });
  if (input.kind === "APPROVAL" && !evaluation.seal) throw new Error("The evaluation being approved has no seal.");

  const serial = await nextSerial(tx, input.at);
  const verifyCode = input.kind === "APPROVAL" ? newVerifyCode() : undefined;
  const statement: SealStatement = {
    v: SEAL_VERSION,
    kind: input.kind,
    serial,
    requestId: input.requestId,
    referenceNo: request.referenceNo,
    signer: { id: signer.id, name: signer.name, role: signer.role },
    signedAt: input.at.toISOString(),
    content,
    evaluation: evaluationDigest(evaluation),
    ...(input.kind === "APPROVAL" ? { evaluationSeal: evaluation.seal!.serial, decision: "APPROVED" as const, verifyCode } : {}),
  };
  const payload = canonical(statement);
  return tx.requestSeal.create({
    data: {
      serial,
      requestId: input.requestId,
      kind: input.kind,
      signerId: signer.id,
      evaluationId: input.kind === "EVALUATION" ? input.evaluationId : null,
      approvalId: input.kind === "APPROVAL" ? input.approvalId : null,
      verifyCode: verifyCode ?? null,
      payload,
      digest: sha256(payload),
      signature: sign(null, Buffer.from(payload, "utf8"), key.privateKey).toString("base64"),
      keyId: key.keyId,
      createdAt: input.at,
    },
  });
}

type SealRow = { serial: string; requestId: string; kind: string; verifyCode: string | null; payload: string; digest: string; signature: string; keyId: string };

/**
 * The seal is what the server signed and has not been altered since: its signature checks with the
 * server's key, and its columns agree with the signed statement. Returns the statement or null.
 */
export function openSeal(row: SealRow): SealStatement | null {
  const key = sealKey();
  if (row.keyId !== key.keyId || sha256(row.payload) !== row.digest) return null;
  let ok = false;
  try {
    ok = verify(null, Buffer.from(row.payload, "utf8"), key.publicKey, Buffer.from(row.signature, "base64"));
  } catch {
    return null;
  }
  if (!ok) return null;
  const s = JSON.parse(row.payload) as SealStatement;
  if (s.serial !== row.serial || s.requestId !== row.requestId || s.kind !== row.kind || (s.verifyCode ?? null) !== row.verifyCode) return null;
  return s;
}

/**
 * Seals evaluations and approvals recorded before seals existed (the drawn signatures, D-117),
 * dated as they were signed, against the request as it stands now. Used once by the backfill script.
 */
export async function sealUnsealed(client: PrismaClient): Promise<{ evaluations: number; approvals: number }> {
  let evaluations = 0;
  let approvals = 0;
  const pendingEvaluations = await client.requestEvaluation.findMany({ where: { seal: null }, orderBy: { createdAt: "asc" }, select: { id: true, requestId: true, reviewerId: true, createdAt: true } });
  for (const e of pendingEvaluations) {
    await client.$transaction((tx) => createSeal(tx, { kind: "EVALUATION", requestId: e.requestId, signerId: e.reviewerId, evaluationId: e.id, at: e.createdAt }));
    evaluations += 1;
  }
  const pendingApprovals = await client.requestApproval.findMany({ where: { seal: null }, orderBy: { createdAt: "asc" }, select: { id: true, requestId: true, managerId: true, createdAt: true } });
  for (const a of pendingApprovals) {
    await client.$transaction((tx) => createSeal(tx, { kind: "APPROVAL", requestId: a.requestId, signerId: a.managerId, approvalId: a.id, at: a.createdAt }));
    approvals += 1;
  }
  return { evaluations, approvals };
}
