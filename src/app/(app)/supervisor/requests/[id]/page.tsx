import type { Metadata } from "next";
import { RequestDetailPage } from "@/components/requests/request-page";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "تفاصيل الطلب" };

export default async function SupervisorRequestPage({ params }: PageProps<"/supervisor/requests/[id]">) {
  const user = await requireUser();
  if (user.role !== "SUPERVISOR") return <ForbiddenPage />;
  const { id } = await params;
  return <RequestDetailPage user={user} id={id} listHref="/supervisor/requests" listLabel="الطلبات" />;
}
