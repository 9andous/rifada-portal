import type { Metadata } from "next";
import { RequestListPage } from "@/components/requests/request-list-page";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";

export const metadata: Metadata = { title: "الطلبات" };

export default async function SupervisorRequestsPage({ searchParams }: PageProps<"/supervisor/requests">) {
  const user = await requireUser();
  if (user.role !== "SUPERVISOR" || !can(user.role, "requests.read")) return <ForbiddenPage />;
  return (
    <RequestListPage
      user={user}
      view="scope"
      path="/supervisor/requests"
      detailBase="/supervisor/requests"
      title="الطلبات"
      lead="جميع الطلبات المقدَّمة في برامجك. تقرّر فيما أُسند إليك، وتطّلع على الباقي وتعلّق عليه."
      emptyTitle="لا توجد طلبات مقدَّمة في برامجك بعد"
      emptyDescription="تظهر هنا الطلبات بعد أن تقدّمها الجمعيات؛ ولا تظهر المسودات."
      searchParams={searchParams}
    />
  );
}
