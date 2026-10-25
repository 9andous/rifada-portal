import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { BandDate } from "@/components/dashboard/band-date";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { EmptyState } from "@/components/states/states";
import { Alert, Panel, PanelHeader } from "@/components/ui/surface";
import { formatNumber, greeting } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getOverview } from "@/server/services/dashboard";

export const metadata: Metadata = { title: "قائمة أعمالي" };

export default async function SupervisorDashboard() {
  const user = await requireUser();
  const now = new Date();
  const overview = await getOverview(user, now);
  const hasPrograms = user.programIds.length > 0;

  return (
    <>
      <PageBand
        eyebrow={`${greeting(now)}، ${user.name}`}
        title="قائمة أعمالي"
        lead="الطلبات المسندة إليك والطلبات الواردة في البرامج التي تشرف عليها."
        actions={<BandDate date={now} />}
        figures={
          <BandFigures
            items={[
              { label: "إجمالي الطلبات", value: formatNumber(overview.total), caption: "في برامجي" },
              { label: "قيد المراجعة", value: formatNumber(overview.underReview), caption: "بانتظار قرار", emphasis: true },
              { label: "معادة للتعديل", value: formatNumber(overview.returned), caption: "بانتظار ردّ الجمعية" },
              { label: "معتمدة", value: formatNumber(overview.approved), caption: "منذ إسناد البرامج" },
            ]}
          />
        }
      />
      <PageBody>
        {!hasPrograms ? (
          <Alert tone="warning" title="لم تُسند إليك برامج بعد" className="mb-6">
            لن تظهر لك أي طلبات حتى يسند إليك مدير النظام برنامجًا واحدًا على الأقل.
          </Alert>
        ) : null}
        <Panel>
          <PanelHeader title="الطلبات في برامجي" />
          {overview.total === 0 ? (
            <EmptyState
              variant="inline"
              icon={<Inbox strokeWidth={1.75} />}
              title="لا توجد طلبات في قائمتك"
              description="عند تقديم الجمعيات طلبات ضمن برامجك ستُسند إليك تلقائيًا وتظهر هنا مع مهلة مراجعة كل طلب."
            />
          ) : (
            <p className="t-body flex flex-wrap gap-x-6 gap-y-2 px-6 pb-6">
              <Link href="/supervisor/queue" className="font-semibold text-primary hover:underline">
                قائمة أعمالي
              </Link>
              <Link href="/supervisor/requests" className="font-semibold text-primary hover:underline">
                جميع الطلبات في برامجي
              </Link>
            </p>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
