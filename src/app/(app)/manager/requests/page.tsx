import type { Metadata } from "next";
import { RequestListPage } from "@/components/requests/request-list-page";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";

export const metadata: Metadata = { title: "الطلبات" };

export default async function ManagerRequestsPage({ searchParams }: PageProps<"/manager/requests">) {
  const user = await requireUser();
  if (user.role !== "UNIT_MANAGER" || !can(user.role, "requests.read")) return <ForbiddenPage />;
  return (
    <RequestListPage
      user={user}
      view="scope"
      path="/manager/requests"
      detailBase="/manager/requests"
      title="الطلبات"
      lead="جميع الطلبات المقدَّمة في البرامج السبعة: القرار والإسناد والمتابعة."
      emptyTitle="لا توجد طلبات مقدَّمة بعد"
      emptyDescription="تظهر هنا الطلبات بعد أن تقدّمها الجمعيات؛ ولا تظهر المسودات."
      searchParams={searchParams}
    />
  );
}
