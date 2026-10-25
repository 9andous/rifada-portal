import type { Metadata } from "next";
import { RequestListPage } from "@/components/requests/request-list-page";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";

export const metadata: Metadata = { title: "قائمة أعمالي" };

export default async function QueuePage({ searchParams }: PageProps<"/supervisor/queue">) {
  const user = await requireUser();
  if (user.role !== "SUPERVISOR" || !can(user.role, "requests.review")) return <ForbiddenPage />;
  return (
    <RequestListPage
      user={user}
      view="queue"
      path="/supervisor/queue"
      detailBase="/supervisor/requests"
      title="قائمة أعمالي"
      lead="الطلبات المفتوحة المسندة إليك: قرّر في ما هو قيد المراجعة، وتابع المعاد منها للتعديل."
      emptyTitle="لا توجد طلبات مفتوحة مسندة إليك"
      emptyDescription="تظهر هنا الطلبات التي تُسند إليك تلقائيًا أو من مدير الوحدة."
      searchParams={searchParams}
    />
  );
}
