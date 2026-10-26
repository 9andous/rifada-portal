import type { Metadata } from "next";
import { BandDate } from "@/components/dashboard/band-date";
import { MonthlyCard, OverdueCard, ProgramsCard, StatusDistributionCard, WorkloadCard } from "@/components/dashboard/cards";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { Alert } from "@/components/ui/surface";
import { buttonClasses } from "@/components/ui/button";
import { daysPhrase, formatNumber, greeting } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getByProgram, getMonthly, getOverdue, getOverview, getWorkload } from "@/server/services/dashboard";
import { getSetting } from "@/server/settings/read";
import Link from "next/link";

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
        lead="حجم الطلبات ومهل مراجعتها وتوزيعها على المشرفين في برامج الرئاسة."
        actions={<BandDate date={now} />}
        figures={
          <BandFigures
            items={[
              {
                label: "إجمالي الطلبات",
                value: formatNumber(overview.total),
                caption: "الطلبات المقدَّمة في جميع البرامج",
                href: "/manager/requests",
              },
              {
                label: "مفتوحة",
                value: formatNumber(overview.open),
                caption: `قيد المراجعة ${formatNumber(overview.underReview)} · معادة ${formatNumber(overview.returned)}`,
                href: "/manager/requests?status=UNDER_REVIEW",
              },
              {
                label: "متأخرة عن المهلة",
                value: formatNumber(overview.overdue),
                caption: `تجاوزت ${daysPhrase(slaDays, "accusative")} عمل`,
                attention: overview.overdue > 0 && "bad",
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
              {
                label: "غير مسندة",
                value: formatNumber(overview.unassigned),
                caption: "طلبات مفتوحة بلا مشرف",
                attention: overview.unassigned > 0 && "warn",
                href: "/manager/assignment",
              },
            ]}
          />
        }
      />
      <PageBody className="flex flex-col gap-5">
        {overview.overdue > 0 || overview.unassigned > 0 ? (
          <Alert
            tone="danger"
            title="طلبات تحتاج متابعة"
            action={
              overview.unassigned ? (
                <Link href="/manager/assignment" className={buttonClasses("dark", "sm")}>
                  إسناد الآن
                </Link>
              ) : null
            }
          >
            متأخرة عن المهلة: {formatNumber(overview.overdue)} · غير مسندة: {formatNumber(overview.unassigned)}. تابع المتأخرة مع المشرفين، وأسند ما لا مشرف له.
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
          <StatusDistributionCard rows={overview.byStatus} href="/manager/requests" />
          <OverdueCard rows={overdue} total={overview.overdue} slaDays={slaDays} now={now} hrefBase="/manager/requests" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ProgramsCard rows={programs} />
          <MonthlyCard months={monthly} />
        </div>
        <WorkloadCard rows={workload} unassigned={overview.unassigned} assignHref="/manager/assignment" />
      </PageBody>
    </>
  );
}
