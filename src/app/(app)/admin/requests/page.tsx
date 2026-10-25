import type { Metadata } from "next";
import { RequestListPage } from "@/components/requests/request-list-page";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";

export const metadata: Metadata = { title: "الطلبات" };

export default async function AdminRequestsPage({ searchParams }: PageProps<"/admin/requests">) {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN" || !can(user.role, "requests.read")) return <ForbiddenPage />;
  return (
    <RequestListPage
      user={user}
      view="scope"
      path="/admin/requests"
      detailBase="/admin/requests"
      eyebrow="اطلاع مدير النظام"
      title="الطلبات"
      lead="اطلاع للقراءة فقط على الطلبات المقدَّمة. يُسجَّل كل فتح لطلب أو تنزيل لملف في سجل التدقيق."
      emptyTitle="لا توجد طلبات مقدَّمة بعد"
      emptyDescription="تظهر هنا الطلبات بعد أن تقدّمها الجمعيات؛ ولا تظهر المسودات."
      searchParams={searchParams}
    />
  );
}
