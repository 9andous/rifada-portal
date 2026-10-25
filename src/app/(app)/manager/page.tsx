import type { Metadata } from "next";
import { BandDate } from "@/components/dashboard/band-date";
import { MonthlyCard, OverdueCard, ProgramsCard, StatusDistributionCard, WorkloadCard } from "@/components/dashboard/cards";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { daysPhrase, formatNumber, greeting } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getByProgram, getMonthly, getOverdue, getOverview, getWorkload } from "@/server/services/dashboard";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "نظرة عامة على الإشراف" };

export default async function ManagerDashboard() {
  const user = await requireUser();
  const now = new Date();
  const [overview, monthly, programs, workload, overdue, slaDays] = await Promise.all([
    getOverview(user, now),
    getMonthly(user, 6, now),
    getByProgram(user),
    getWorkload(now),
    getOverdue(user, 6, now),
    getSetting("sla.workingDays"),
  ]);

  return (
    <>
      <PageBand
        eyebrow={`${greeting(now)}، ${user.name}`}
        title="نظرة عامة على الإشراف"
        actions={<BandDate date={now} />}
        figures={
          <BandFigures
            items={[
              { label: "إجمالي الطلبات", value: formatNumber(overview.total), caption: "الطلبات المقدَّمة في جميع البرامج" },
              {
                label: "مفتوحة",
                value: formatNumber(overview.open),
                caption: `قيد المراجعة ${formatNumber(overview.underReview)} · معادة ${formatNumber(overview.returned)}`,
              },
              {
                label: "متأخرة عن المهلة",
                value: formatNumber(overview.overdue),
                caption: `تجاوزت ${daysPhrase(slaDays, "accusative")} عمل`,
                emphasis: true,
              },
              {
                label: "متوسط المعالجة",
                value: overview.avgHandlingDays === null ? "—" : formatNumber(overview.avgHandlingDays),
                unit: overview.avgHandlingDays === null ? undefined : "يوم",
                caption: overview.avgHandlingDays === null ? "لا توجد طلبات منجزة بعد" : "من التقديم إلى القرار",
              },
              {
                label: "نسبة الاعتماد",
                value: overview.approvalRate === null ? "—" : formatNumber(overview.approvalRate),
                unit: overview.approvalRate === null ? undefined : "٪",
                caption: overview.approvalRate === null ? "لا توجد قرارات بعد" : "من الطلبات المبتوت فيها",
              },
              { label: "غير مسندة", value: formatNumber(overview.unassigned), caption: "طلبات مفتوحة بلا مشرف" },
            ]}
          />
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
          <OverdueCard rows={overdue} total={overview.overdue} slaDays={slaDays} now={now} hrefBase="/manager/requests" />
          <StatusDistributionCard rows={overview.byStatus} />
          <MonthlyCard months={monthly} />
          <ProgramsCard rows={programs} />
          <div className="lg:col-span-2">
            <WorkloadCard rows={workload} unassigned={overview.unassigned} />
          </div>
        </div>
      </PageBody>
    </>
  );
}
