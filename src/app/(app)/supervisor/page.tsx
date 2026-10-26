import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { BandDate } from "@/components/dashboard/band-date";
import { OverdueCard, RecentRequestsCard, StatusDistributionCard } from "@/components/dashboard/cards";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { EmptyState } from "@/components/states/states";
import { Alert } from "@/components/ui/surface";
import { formatNumber, greeting } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getOverdue, getOverview } from "@/server/services/dashboard";
import { listRequests, parseRequestListParams } from "@/server/services/requests/read";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "قائمة أعمالي" };


export default async function SupervisorDashboard() {
  const user = await requireUser();
  const now = new Date();
  const [overview, overdue, queue, slaDays] = await Promise.all([
    getOverview(user, now),
    getOverdue(user, 5, now),
    listRequests(user, parseRequestListParams({ sort: "slaDueAt", dir: "asc" }, "queue"), "queue", now),
    getSetting("sla.workingDays"),
  ]);
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
              { label: "إجمالي الطلبات", value: formatNumber(overview.total), caption: "في برامجي", href: "/supervisor/requests" },
              {
                label: "قيد المراجعة",
                value: formatNumber(overview.underReview),
                caption: "بانتظار قرارك",
                attention: overview.underReview > 0 && "warn",
                href: "/supervisor/queue",
              },
              { label: "معادة للتعديل", value: formatNumber(overview.returned), caption: "بانتظار ردّ الجمعية" },
              { label: "معتمدة", value: formatNumber(overview.approved), caption: "منذ إسناد البرامج" },
            ]}
          />
        }
      />
      <PageBody className="flex flex-col gap-5">
        {!hasPrograms ? (
          <Alert tone="warning" title="لم تُسند إليك برامج بعد">
            لن تظهر لك أي طلبات حتى يسند إليك مدير النظام برنامجًا واحدًا على الأقل.
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
          <RecentRequestsCard
            title="بانتظار مراجعتك"
            rows={queue.items.slice(0, 6)}
            total={queue.total}
            hrefBase="/supervisor/requests"
            listHref="/supervisor/queue"
            showAssociation
            empty={
              <EmptyState
                variant="inline"
                icon={<Inbox strokeWidth={1.75} />}
                title="لا توجد طلبات في قائمتك"
                description="عند تقديم الجمعيات طلبات ضمن برامجك ستُسند إليك تلقائيًا وتظهر هنا مرتبة حسب أقرب مهلة."
              />
            }
          />
          <OverdueCard rows={overdue} total={overview.overdue} slaDays={slaDays} now={now} hrefBase="/supervisor/requests" />
        </div>
        <StatusDistributionCard rows={overview.byStatus} href="/supervisor/requests" />
      </PageBody>
    </>
  );
}
