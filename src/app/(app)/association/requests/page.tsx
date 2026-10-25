import type { Metadata } from "next";
import { NewRequestLink, RequestListPage } from "@/components/requests/request-list-page";
import { Alert } from "@/components/ui/surface";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";

export const metadata: Metadata = { title: "طلباتي" };

export default async function MyRequestsPage({ searchParams }: PageProps<"/association/requests">) {
  const user = await requireUser();
  if (user.role !== "ASSOCIATION_OFFICER" || !can(user.role, "requests.read")) return <ForbiddenPage />;
  return (
    <RequestListPage
      user={user}
      view="mine"
      path="/association/requests"
      detailBase="/association/requests"
      eyebrow={user.associationName ?? undefined}
      title="طلباتي"
      lead="طلبات جمعيتكم ومسوداتها. المسودات لا تطّلع عليها الوحدة الإشرافية حتى تقدّموها."
      actions={<NewRequestLink />}
      emptyTitle="لم تنشئوا أي طلب بعد"
      emptyDescription="ابدؤوا طلبًا جديدًا ضمن أحد برامج الرئاسة، واحفظوه مسودة حتى يكتمل ثم قدّموه."
      emptyAction={<NewRequestLink variant="primary" />}
      searchParams={searchParams}
      notice={<DiscardedNotice searchParams={searchParams} />}
    />
  );
}

async function DiscardedNotice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return params.discarded === "1" ? <Alert tone="success">حُذفت المسودة وملفاتها.</Alert> : null;
}
