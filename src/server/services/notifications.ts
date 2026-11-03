import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { requestHref } from "@/lib/requests";
import { isRole } from "@/server/authz/roles";
import { db } from "@/server/db";
import { signalUsers } from "@/server/realtime";
import { formatHijri, formatTime } from "@/lib/format";

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
  | "request.evaluated"
  | "request.scope_changed"
  | "request.manager_decided"
  | "request.evaluation_edited"
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
    .map((u) => ({ userId: u.id, type: input.type, title: input.title, body: input.body ?? null, link: requestHref(u.role, input.requestId), requestId: input.requestId }));
  if (rows.length) {
    await tx.notification.createMany({ data: rows });
    // Live bell and toast: delivered to the recipients' open pages when this transaction commits.
    await signalUsers(tx, rows.map((r) => r.userId), "new");
  }
  return rows.length;
}

export type NotificationItem = { id: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: Date };

/** The bell in the header: the user's latest notifications and how many are unread. */
export async function listNotifications(userId: string, limit = 8): Promise<{ items: NotificationItem[]; unread: number }> {
  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items: rows.map(({ readAt, ...r }) => ({ ...r, read: readAt !== null })), unread };
}

/** The bell's payload: the latest notifications with their display time, and the unread count. */
export type BellItem = { id: string; title: string; body: string | null; link: string | null; read: boolean; when: string };
export async function bellView(userId: string): Promise<{ items: BellItem[]; unread: number }> {
  const { items, unread } = await listNotifications(userId);
  return { unread, items: items.map(({ createdAt, ...n }) => ({ ...n, when: `${formatHijri(createdAt)}، ${formatTime(createdAt)}` })) };
}

/** Marks one of the user's notifications read, or all of them when `id` is omitted. */
export async function markNotificationsRead(userId: string, id?: string): Promise<void> {
  const { count } = await db.notification.updateMany({ where: { userId, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
  if (count) await signalUsers(db, [userId], "read");
}

/**
 * Opening a request settles what it was about: every unread notification of the user that links
 * to that request is marked read, and the request's row loses its «جديد» (D-130).
 */
export async function markRequestNotificationsRead(userId: string, requestId: string): Promise<void> {
  const now = new Date();
  const { count } = await db.notification.updateMany({ where: { userId, readAt: null, ...aboutRequest(requestId) }, data: { readAt: now } });
  if ((await db.request.count({ where: { id: requestId } })) > 0) {
    await db.requestSeen.upsert({ where: { userId_requestId: { userId, requestId } }, create: { userId, requestId, seenAt: now }, update: { seenAt: now } });
  }
  if (count) await signalUsers(db, [userId], "read");
}

/** Notifications about one request (older rows name it only in their link). */
const aboutRequest = (requestId: string): Prisma.NotificationWhereInput => ({ OR: [{ requestId }, { link: { endsWith: `/${requestId}` } }] });

/**
 * An action on a request (D-130), inside its transaction. The actor's notifications about it are
 * settled (deleted), whether or not they were opened from the bell, and the actor has seen it as it
 * now stands. With `activity` (the default) its last activity moves to now, so everyone else who
 * has not opened it since sees «جديد» on its row.
 */
export async function recordRequestAction(tx: Prisma.TransactionClient, actorId: string, requestId: string, { activity = true }: { activity?: boolean } = {}): Promise<void> {
  const now = new Date();
  if (activity) await tx.request.update({ where: { id: requestId }, data: { lastActivityAt: now } });
  await tx.requestSeen.upsert({ where: { userId_requestId: { userId: actorId, requestId } }, create: { userId: actorId, requestId, seenAt: now }, update: { seenAt: now } });
  const { count } = await tx.notification.deleteMany({ where: { userId: actorId, ...aboutRequest(requestId) } });
  if (count) await signalUsers(tx, [actorId], "read");
}
