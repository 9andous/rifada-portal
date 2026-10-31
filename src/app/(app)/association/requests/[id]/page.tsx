import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssociationRequestView } from "@/components/association/request-detail";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { requireUser } from "@/server/auth/session";
import { getRequestDetail } from "@/server/services/requests/read";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "تفاصيل الطلب" };

/** The officer's request page (D-102); staff use the shared RequestView. A request they may not read answers 404. */
export default async function OfficerRequestPage({ params, searchParams }: PageProps<"/association/requests/[id]">) {
  const user = await requireUser();
  if (user.role !== "ASSOCIATION_OFFICER") return <ForbiddenPage />;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [request, maxMb, allowedGroups, slaDays] = await Promise.all([
    getRequestDetail(user, id),
    getSetting("uploads.maxFileMb"),
    getSetting("uploads.allowedGroups"),
    getSetting("sla.workingDays"),
  ]);
  if (!request) notFound();
  return <AssociationRequestView request={request} uploads={{ maxMb, allowedGroups: [...allowedGroups] }} slaDays={slaDays} justSubmitted={query.submitted === "1"} />;
}
