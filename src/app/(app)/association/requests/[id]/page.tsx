import type { Metadata } from "next";
import { RequestDetailPage } from "@/components/requests/request-page";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "تفاصيل الطلب" };

export default async function OfficerRequestPage({ params, searchParams }: PageProps<"/association/requests/[id]">) {
  const user = await requireUser();
  if (user.role !== "ASSOCIATION_OFFICER") return <ForbiddenPage />;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <RequestDetailPage user={user} id={id} listHref="/association/requests" listLabel="طلباتي" justSubmitted={query.submitted === "1"} />;
}
