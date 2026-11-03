import "server-only";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { listRequests, parseRequestListParams, type RequestRow } from "@/server/services/requests/read";

// The association officer's home (D-102): the requests that wait on them (returned ones with the
// supervisor's latest note and its date, then drafts) and their latest requests. Read-only; every
// query goes through the request list's scope (the officer's own association).

export type ReturnedRow = RequestRow & { note: string | null; returnedAt: Date | null };
/** `notificationId`: the unread «approved» notification; dismissing the notice marks it read. */
export type ApprovedRow = RequestRow & { note: string | null; approvedAt: Date; notificationId: string };

export type AssociationHome = {
  returned: ReturnedRow[];
  /** Accepted requests whose «approved» notification is still unread, newest first (owner's request). */
  approved: ApprovedRow[];
  drafts: RequestRow[];
  latest: RequestRow[];
};

const newestFirst = (extra: Record<string, string> = {}) => parseRequestListParams({ sort: "updatedAt", dir: "desc", ...extra }, "mine");

export async function getAssociationHome(actor: Actor, now: Date = new Date()): Promise<AssociationHome> {
  const [returned, approved, drafts, latest] = await Promise.all([
    listRequests(actor, newestFirst({ status: "RETURNED" }), "mine", now),
    listRequests(actor, newestFirst({ status: "APPROVED" }), "mine", now),
    listRequests(actor, newestFirst({ status: "DRAFT" }), "mine", now),
    listRequests(actor, newestFirst(), "mine", now),
  ]);

  const notes = returned.items.length
    ? await db.requestStatusHistory.findMany({
        where: { requestId: { in: returned.items.map((r) => r.id) }, toStatus: { key: "RETURNED" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { requestId: true, note: true, createdAt: true },
      })
    : [];

  // An acceptance stays announced until its notification is read: the ✕ on the notice, or the bell.
  const unread = approved.items.length
    ? await db.notification.findMany({ where: { userId: actor.id, type: "request.approved", readAt: null }, select: { id: true, link: true } })
    : [];
  const unreadFor = (requestId: string) => unread.find((n) => n.link?.endsWith(`/${requestId}`))?.id;
  const announced = approved.items.filter((r) => unreadFor(r.id));
  const approvals = announced.length
    ? await db.requestStatusHistory.findMany({
        where: { requestId: { in: announced.map((r) => r.id) }, toStatus: { key: "APPROVED" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { requestId: true, note: true, createdAt: true },
      })
    : [];

  return {
    approved: announced.flatMap((r) => {
      const last = approvals.find((a) => a.requestId === r.id);
      const notificationId = unreadFor(r.id);
      return last && notificationId ? [{ ...r, note: last.note, approvedAt: last.createdAt, notificationId }] : [];
    }),
    returned: returned.items.map((r) => {
      const last = notes.find((n) => n.requestId === r.id);
      return { ...r, note: last?.note ?? null, returnedAt: last?.createdAt ?? null };
    }),
    drafts: drafts.items,
    latest: latest.items.slice(0, 5),
  };
}
