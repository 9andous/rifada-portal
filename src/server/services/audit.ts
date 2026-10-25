import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

type AuditClient = Pick<typeof db, "auditLog"> | Prisma.TransactionClient;

async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return { ip: forwarded || h.get("x-real-ip"), userAgent: h.get("user-agent") };
  } catch {
    // Outside a request (seed scripts, background jobs).
    return { ip: null, userAgent: null };
  }
}

const SECRET_KEY = /password|hash|token|secret/i;
/** Flags whose names look secret but hold no secret. */
const NOT_SECRET = new Set(["mustChangePassword"]);

/**
 * Removes secret-looking keys from audit snapshots, at any depth. Callers already build snapshots
 * from explicit field lists; this is the second line of defence so a secret can never be audited.
 */
export function redactSecrets(value: Prisma.InputJsonValue | undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v as Prisma.InputJsonValue) ?? null);
  const out: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, v] of Object.entries(value)) {
    if (SECRET_KEY.test(key) && !NOT_SECRET.has(key)) continue;
    out[key] = v === null ? null : (redactSecrets(v as Prisma.InputJsonValue) ?? null);
  }
  return out;
}

/**
 * Append an audit entry. Pass a transaction client to make the entry atomic with the change.
 * Audit rows are never updated or deleted.
 */
export async function audit(entry: AuditEntry, client: AuditClient = db): Promise<void> {
  const meta = await requestMeta();
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: redactSecrets(entry.before),
      after: redactSecrets(entry.after),
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
}
