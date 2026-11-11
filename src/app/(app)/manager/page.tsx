import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Clock, Eye, FileText, Gauge, Inbox, UserRoundCheck } from "lucide-react";
import { BandDate } from "@/components/dashboard/band-date";
import { MonthlyCard, ProgramsCard, StatusDistributionCard, TracksCard, WorkloadCard } from "@/components/dashboard/cards";
import { KpiRow } from "@/components/dashboard/kpis";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { buttonClasses } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { Alert } from "@/components/ui/surface";
import { daysPhrase, formatNumber, greeting, requestsPhrase } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getByProgram, getByTrack, getMonthly, getOverview, getWorkload, MONTH_RANGES } from "@/server/services/dashboard";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "نظرة عامة على الإشراف" };

const REQUESTS = "/manager/requests";
const UNASSIGNED = `${REQUESTS}?supervisor=none`;

export default async function ManagerDashboard({ searchParams }: PageProps<"/manager">) {
  const user = await requireUser();
  const now = new Date();
  const asked = Number((await searchParams).months);
  const range = (MONTH_RANGES as readonly number[]).includes(asked) ? asked : 6;
  const [overview, monthly, programs, tracks, workload, slaDays, awaiting] = await Promise.all([
    getOverview(user, now),
    getMonthly(user, range, now),
    getByProgram(user),
    getByTrack(user),
    getWorkload(now),
    getSetting("sla.workingDays"),
    // Evaluated and signed by the supervisor, waiting for the final approval (D-116).
    db.request.count({ where: { status: { key: "UNDER_REVIEW" }, reviewStage: "MANAGER" } }),
  ]);
  const thisMonth = monthly.at(-1)?.count ?? 0;
  const attention = [
    overview.overdue ? `${requestsPhrase(overview.overdue)} تجاوزت مهلة المراجعة` : null,
    overview.unassigned ? `${requestsPhrase(overview.unassigned)} غير مسندة` : null,
  ].filter(Boolean);

  return (
    <>
      <PageBand
        eyebrow={`${greeting(now)}، ${user.name}`}
        title="نظرة عامة على الإشراف"
        lead="متابعة شاملة لطلبات الجمعيات في جميع البرامج ومراحل المراجعة."
        actions={
          <>
            <BandDate date={now} />
            <PrintButton variant="outline" />
          </>
        }
        figures={
          <KpiRow
            items={[
              {
                label: "إجمالي الطلبات",
                icon: Inbox,
                featured: true,
                value: formatNumber(overview.total),
                badge: thisMonth ? `+${formatNumber(thisMonth)}` : undefined,
                caption: thisMonth ? "هذا الشهر" : "في جميع البرامج",
                href: REQUESTS,
              },
              {
                label: "مفتوحة",
                icon: FileText,
                tone: "info",
                value: formatNumber(overview.open),
                caption: `قيد المراجعة ${formatNumber(overview.underReview)} · معادة ${formatNumber(overview.returned)}`,
                href: `${REQUESTS}?status=UNDER_REVIEW`,
              },
              {
                label: "متأخرة عن المهلة",
                icon: Clock,
                tone: "bad",
                alert: overview.overdue > 0,
                value: formatNumber(overview.overdue),
                caption: `تجاوزت ${daysPhrase(slaDays, "accusative")} عمل`,
                href: `${REQUESTS}?overdue=1`,
              },
              {
                label: "متوسط المعالجة",
                icon: Gauge,
                tone: "gold",
                value: overview.avgHandlingDays === null ? "—" : formatNumber(overview.avgHandlingDays),
                unit: overview.avgHandlingDays === null ? undefined : "يوم",
                caption: overview.avgHandlingDays === null ? "لا توجد طلبات منجزة بعد" : "من التقديم إلى القرار",
              },
              {
                label: "نسبة الاعتماد",
                icon: CircleCheck,
                tone: "ok",
                value: overview.approvalRate === null ? "—" : `${formatNumber(overview.approvalRate)}٪`,
                caption: overview.approvalRate === null ? "لا توجد قرارات بعد" : "من القرارات الصادرة",
              },
              {
                label: "غير مسندة",
                icon: UserRoundCheck,
                tone: "warn",
                alert: overview.unassigned > 0,
                value: formatNumber(overview.unassigned),
                caption: "بانتظار مشرف",
                href: UNASSIGNED,
              },
            ]}
          />
        }
      />
      <PageBody className="flex flex-col gap-5">
        {awaiting ? (
          <Alert
            ruled
            tone="info"
            title={`${requestsPhrase(awaiting)} بانتظار قرارك بعد توصية المشرف وتوقيعه`}
            action={
              <Link href={`${REQUESTS}?stage=manager`} className={buttonClasses("primary", "sm")}>
                <Eye aria-hidden="true" />
                مراجعتها الآن
              </Link>
            }
          />
        ) : null}
        {attention.length ? (
          <Alert
            tone="danger"
            ruled
            title={attention.join(" و")}
            action={
              <>
                {overview.overdue ? (
                  <Link href={`${REQUESTS}?overdue=1`} className={buttonClasses("outline", "sm")}>
                    <Eye aria-hidden="true" />
                    عرض المتأخرة
                  </Link>
                ) : null}
                {overview.unassigned ? (
                  <Link href={UNASSIGNED} className={buttonClasses("outline", "sm")}>
                    <UserRoundCheck aria-hidden="true" />
                    عرض غير المسندة
                  </Link>
                ) : null}
              </>
            }
          >
            {[overview.overdue ? "تابع المشرفين لتفادي تجاوز مهلة المراجعة." : null, overview.unassigned ? "أسند الطلبات إلى مشرف لتبدأ مراجعتها." : null]
              .filter(Boolean)
              .join(" ")}
          </Alert>
        ) : null}

        {/* Card order by the owner's review (2026-11-01): programmes and tracks first, then the status
            distribution. The overdue card, quick links and assignment screen were removed on 2026-11-02. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
          <ProgramsCard rows={programs} hrefBase={REQUESTS} />
          <TracksCard data={tracks} tracksHref="/manager/taxonomy/tracks" />
        </div>
        <StatusDistributionCard rows={overview.byStatus} href={REQUESTS} />
        <MonthlyCard months={monthly} range={range} rangeHref={(n) => (n === 6 ? "/manager" : `/manager?months=${n}`)} />
        <WorkloadCard rows={workload} unassigned={overview.unassigned} requestsHref={REQUESTS} />
      </PageBody>
    </>
  );
}
