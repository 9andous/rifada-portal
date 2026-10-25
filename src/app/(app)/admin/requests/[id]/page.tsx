import type { Metadata } from "next";
import { RequestDetailPage } from "@/components/requests/request-page";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "تفاصيل الطلب" };

export default async function AdminRequestPage({ params }: PageProps<"/admin/requests/[id]">) {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return <ForbiddenPage />;
  const { id } = await params;
  return <RequestDetailPage user={user} id={id} listHref="/admin/requests" listLabel="الطلبات" />;
}
