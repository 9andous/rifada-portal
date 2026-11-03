import "server-only";
import { requestHref } from "@/lib/requests";
import type { Role } from "@/server/authz/roles";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { normalizeVerifyCode } from "@/lib/verify-code";
import { contentDigest, evaluationDigest, openSeal, type SealStatement } from "@/server/seal/seal";
import { audit } from "@/server/services/audit";

// Verifying a printed or shared request document by its code (D-122): the page the QR code opens,
// for anyone, and «التحقق من وثيقة» inside the platform. The public answer is minimal (reference,
// association, project, decision, signers); signed-in staff also get a link to the request and the
// seal's technical details. Internal notes and the evaluation itself are never shown.

/** The link printed in the QR code: the public verification page of this code. */
export function verifyUrl(code: string): string {
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/verify/${code}`;
}

export const SIGNER_ROLE = { EVALUATION: "المشرف المختص", APPROVAL: "مدير الوحدة الإشرافية" } as const;

export type VerifiedSigner = { kind: "EVALUATION" | "APPROVAL"; role: string; name: string; serial: string; signedAt: Date };

export type VerifyResult =
  | { state: "not_found" }
  /** tampered: the seal fails its signature check; changed: the request changed after approval;
   *  superseded: the request is no longer approved under this approval (returned, re-decided). */
  | { state: "invalid"; reason: "tampered" | "changed" | "superseded"; referenceNo: string | null }
  | {
      state: "valid";
      code: string;
      referenceNo: string | null;
      association: string;
      title: string;
      program: string | null;
      track: string | null;
      approvedAt: Date;
      signers: VerifiedSigner[];
      staff: { href: string; keyId: string; digest: string } | null;
    };

const STAFF: readonly Role[] = ["SUPER_ADMIN", "UNIT_MANAGER", "SUPERVISOR"];

const signer = (s: SealStatement): VerifiedSigner => ({ kind: s.kind, role: SIGNER_ROLE[s.kind], name: s.signer.name, serial: s.serial, signedAt: new Date(s.signedAt) });

/** Checks a code and audits the attempt, whoever made it and whatever the outcome. */
export async function verifyDocument(input: string, viewer: Actor | null): Promise<VerifyResult> {
  const { result, requestId } = await check(input, viewer);
  await audit({
    actorId: viewer?.id ?? null,
    action: "document.verified",
    entityType: "Request",
    entityId: requestId,
    after: { code: normalizeVerifyCode(input) ?? input.slice(0, 40), result: result.state === "invalid" ? `invalid:${result.reason}` : result.state },
  });
  return result;
}

async function check(input: string, viewer: Actor | null): Promise<{ result: VerifyResult; requestId: string | null }> {
  const notFound = { result: { state: "not_found" } as const, requestId: null };
  const code = normalizeVerifyCode(input);
  if (!code) return notFound;
  const seal = await db.requestSeal.findUnique({
    where: { verifyCode: code },
    select: {
      serial: true,
      requestId: true,
      kind: true,
      verifyCode: true,
      payload: true,
      digest: true,
      signature: true,
      keyId: true,
      approvalId: true,
      request: { select: { referenceNo: true, title: true, status: { select: { key: true } }, association: { select: { name: true } }, track: { select: { name: true } }, program: { select: { name: true } } } },
    },
  });
  if (!seal || seal.kind !== "APPROVAL") return notFound;
  const requestId = seal.requestId;
  const invalid = (reason: "tampered" | "changed" | "superseded") => ({ result: { state: "invalid", reason, referenceNo: seal.request.referenceNo } as const, requestId });

  const approval = openSeal(seal);
  const evaluationRow = approval?.evaluationSeal ? await db.requestSeal.findUnique({ where: { serial: approval.evaluationSeal } }) : null;
  const evaluation = evaluationRow && evaluationRow.requestId === seal.requestId ? openSeal(evaluationRow) : null;
  if (!approval || !evaluation) return invalid("tampered");

  const [latestApproval, latestEvaluation, content] = await Promise.all([
    db.requestApproval.findFirst({ where: { requestId: seal.requestId }, orderBy: { createdAt: "desc" }, select: { id: true } }),
    db.requestEvaluation.findFirst({ where: { requestId: seal.requestId }, orderBy: { createdAt: "desc" }, select: { criteria: true, note: true } }),
    contentDigest(db, seal.requestId, approval.v),
  ]);
  if (seal.request.status.key !== "APPROVED" || latestApproval?.id !== seal.approvalId) return invalid("superseded");
  if (content !== approval.content || !latestEvaluation || evaluationDigest(latestEvaluation) !== approval.evaluation) return invalid("changed");

  const isStaff = viewer !== null && STAFF.includes(viewer.role);
  return {
    requestId,
    result: {
      state: "valid",
      code,
      referenceNo: seal.request.referenceNo,
      association: seal.request.association.name,
      title: seal.request.title,
      program: seal.request.program?.name ?? null,
      track: seal.request.track?.name ?? null,
      approvedAt: new Date(approval.signedAt),
      signers: [signer(evaluation), signer(approval)],
      staff: isStaff ? { href: requestHref(viewer.role, requestId), keyId: seal.keyId, digest: seal.digest } : null,
    },
  };
}
