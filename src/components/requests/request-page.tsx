import { notFound } from "next/navigation";
import type { CurrentUser } from "@/server/auth/session";
import { getRequestDetail } from "@/server/services/requests/read";
import { getSetting } from "@/server/settings/read";
import { RequestView } from "./request-view";

/**
 * Loads the request for the signed-in user and renders the shared request page. A request the user
 * may not read (another association's, a program outside the supervisor's, any draft for staff)
 * answers 404, so nothing reveals that it exists.
 */
export async function RequestDetailPage({
  user,
  id,
  listHref,
  listLabel,
  justSubmitted,
}: {
  user: CurrentUser;
  id: string;
  listHref: string;
  listLabel: string;
  justSubmitted?: boolean;
}) {
  const [request, maxMb, allowedGroups] = await Promise.all([getRequestDetail(user, id), getSetting("uploads.maxFileMb"), getSetting("uploads.allowedGroups")]);
  if (!request) notFound();
  return <RequestView request={request} listHref={listHref} listLabel={listLabel} uploads={{ maxMb, allowedGroups: [...allowedGroups] }} justSubmitted={justSubmitted} />;
}
