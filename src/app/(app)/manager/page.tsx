import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleCheck,
  Clock,
  Eye,
  FileStack,
  FileText,
  Gauge,
  Inbox,
  Layers,
  PenLine,
  Building2,
  TriangleAlert,
  UserRoundCheck,
  Workflow,
} from "lucide-react";
import { BandDate } from "@/components/dashboard/band-date";
import { MonthlyCard, OverdueCard, ProgramsCard, StatusDistributionCard, TracksCard, WorkloadCard } from "@/components/dashboard/cards";
import { KpiRow, QuickActions } from "@/components/dashboard/kpis";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { buttonClasses } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { Alert } from "@/components/ui/surface";
import { daysPhrase, formatNumber, greeting, requestsPhrase } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getByProgram, getByTrack, getMonthly, getOverdue, getOverview, getWorkload, MONTH_RANGES } from "@/server/services/dashboard";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "نظرة عامة على الإشراف" };

const REQUESTS = "/manager/requests";

export default async function ManagerDashboard({ searchParams }: PageProps<"/manager">) {
  const user = await requireUser();
  const now = new Date();
  const asked = Number((await searchParams).months);
  const range = (MONTH_RANGES as readonly number[]).includes(asked) ? asked : 6;
  const [overview, monthly, programs, tracks, workload, overdue, slaDays, associations, initiatives, awaiting] = await Promise.all([
    getOverview(user, now),
    getMonthly(user, range, now),
    getByProgram(user),
    getByTrack(user),
    getWorkload(now),
    getOverdue(user, 6, now),
    getSetting("sla.workingDays"),
    db.association.count({ where: { isActive: true } }),
    db.initiative.count({ where: { archivedAt: null } }),
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
                href: "/manager/assignment",
              },
            ]}
          />
        }
      />
      <PageBody className="flex flex-col gap-5">
        {awaiting ? (
          <Alert
            tone="info"
            icon={<PenLine strokeWidth={1.75} className="!size-[22px]" />}
            title={`${requestsPhrase(awaiting)} بانتظار اعتمادك بعد تقييم المشرف وتوقيعه`}
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
            icon={<TriangleAlert strokeWidth={1.75} className="!size-[22px]" />}
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
                  <Link href="/manager/assignment" className={buttonClasses("dark", "sm")}>
                    <UserRoundCheck aria-hidden="true" />
                    إسناد الآن
                  </Link>
                ) : null}
              </>
            }
          >
            أسنِد الطلبات المعلّقة وتابع المشرفين لتفادي تجاوز مهلة المراجعة.
          </Alert>
        ) : null}

        <QuickActions
          items={[
            {
              label: "إسناد الطلبات",
              icon: UserRoundCheck,
              href: "/manager/assignment",
              hint: overview.unassigned ? `${requestsPhrase(overview.unassigned)} بانتظار الإسناد` : "لا طلبات بانتظار الإسناد",
            },
            { label: "جميع الطلبات", icon: Inbox, href: REQUESTS, hint: `${formatNumber(overview.open)} مفتوحة من ${formatNumber(overview.total)}` },
            { label: "الجمعيات", icon: Building2, href: "/manager/associations", hint: `${formatNumber(associations)} جمعية نشطة` },
            { label: "البرامج والمبادرات", icon: Layers, href: "/manager/taxonomy", hint: `${formatNumber(programs.length)} برامج و${formatNumber(initiatives)} مبادرة` },
            { label: "دورة حياة الطلب", icon: Workflow, href: "/manager/taxonomy/lifecycle", hint: `المهلة ${daysPhrase(slaDays)} عمل`, gold: true },
            { label: "الأدلة والنماذج", icon: FileStack, href: "/manager/taxonomy/templates", hint: "المتاحة للجمعيات", gold: true },
          ]}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
          <StatusDistributionCard rows={overview.byStatus} href={REQUESTS} />
          <OverdueCard
              rows={overdue}
              total={overview.overdue}
              slaDays={slaDays}
              now={now}
              hrefBase={REQUESTS}
              assignHref="/manager/assignment"
              listHref={`${REQUESTS}?overdue=1&sort=slaDueAt&dir=asc`}
            />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <TracksCard data={tracks} tracksHref="/manager/taxonomy/tracks" />
          <ProgramsCard rows={programs} hrefBase={REQUESTS} />
        </div>
        <MonthlyCard months={monthly} range={range} rangeHref={(n) => (n === 6 ? "/manager" : `/manager?months=${n}`)} />
        <WorkloadCard rows={workload} unassigned={overview.unassigned} assignHref="/manager/assignment" requestsHref={REQUESTS} />
      </PageBody>
    </>
  );
}
