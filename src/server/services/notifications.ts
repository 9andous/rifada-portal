import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { requestHref } from "@/lib/requests";
import { isRole } from "@/server/authz/roles";

// In-platform notifications (Phase 3 writes the rows; the bell and notification centre are Phase 4).
// Email and SMS stay stubs behind `ExternalNotifier`; nothing is sent outside the platform.

export type NotificationType =
  | "request.submitted"
  | "request.assigned"
  | "request.unassigned"
  | "request.reassigned_away"
  | "request.returned"
  | "request.approved"
  | "request.rejected"
  | "request.resubmitted"
  | "comment.created"
  | "comment.reply";

export type NotificationInput = { type: NotificationType; title: string; body?: string; requestId: string };

/** Email/SMS delivery (stub). A real channel implements `deliver`; the stub does nothing. */
export interface ExternalNotifier {
  deliver(userId: string, notification: NotificationInput): Promise<void>;
}

export class StubExternalNotifier implements ExternalNotifier {
  async deliver(): Promise<void> {
    // Intentionally empty: email and SMS are stubs until the Presidency's channels are decided.
  }
}

export const externalNotifier: ExternalNotifier = new StubExternalNotifier();

/**
 * Writes one notification per active recipient (deduplicated, never to the actor), each linking to
 * the request page of the recipient's own role. Call inside the transaction of the change.
 */
export async function notify(
  tx: Prisma.TransactionClient,
  recipientIds: readonly (string | null | undefined)[],
  input: NotificationInput,
  actorId: string | null,
): Promise<number> {
  const ids = [...new Set(recipientIds.filter((id): id is string => Boolean(id) && id !== actorId))];
  if (ids.length === 0) return 0;
  const users = await tx.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, role: true } });
  const rows = users
    .filter((u) => isRole(u.role))
    .map((u) => ({ userId: u.id, type: input.type, title: input.title, body: input.body ?? null, link: requestHref(u.role, input.requestId) }));
  if (rows.length) await tx.notification.createMany({ data: rows });
  return rows.length;
}
