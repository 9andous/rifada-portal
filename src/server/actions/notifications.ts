"use server";

import { requireUser } from "@/server/auth/session";
import { markNotificationsRead, markRequestNotificationsRead } from "@/server/services/notifications";

/** The bell: marks one notification read (when opened), or all of them. Only the user's own rows. */
export async function markNotificationReadAction(id?: string): Promise<void> {
  const user = await requireUser();
  await markNotificationsRead(user.id, id);
}

/** Opening a request marks its notifications read (the request page calls this once on load). */
export async function markRequestSeenAction(requestId: string): Promise<void> {
  const user = await requireUser();
  await markRequestNotificationsRead(user.id, requestId);
}
