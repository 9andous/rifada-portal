import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, ClipboardCheck, Eye, Inbox, List, ListChecks, TriangleAlert, Undo2 } from "lucide-react";
import { BandDate } from "@/components/dashboard/band-date";
import { CardEmpty, CardTabs, OverdueCard, RequestsTableCard, StatusDistributionCard, TracksCard } from "@/components/dashboard/cards";
import { KpiRow } from "@/components/dashboard/kpis";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";
import { formatNumber, greeting } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getByTrack, getOverdue, getOverview } from "@/server/services/dashboard";
import { listRequests, parseRequestListParams, requestStatusCounts } from "@/server/services/requests/read";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "قائمة أعمالي" };

const DETAIL = "/supervisor/requests";
const QUEUE = "/supervisor/queue";

/** Tabs of the queue card: all, by status, and overdue (handoff «قائمة أعمالي»). */
const TABS: { key: string; label: string; icon: ReactNode; params: Record<string, string> }[] = [
  { key: "all", label: "الكل", icon: <List strokeWidth={1.75} />, params: {} },
  { key: "review", label: "قيد المراجعة", icon: <Eye strokeWidth={1.75} />, params: { status: "UNDER_REVIEW" } },
  { key: "completeness", label: "فحص الاكتمال", icon: <ClipboardCheck strokeWidth={1.75} />, params: { status: "COMPLETENESS_CHECK" } },
  { key: "returned", label: "معاد للتعديل", icon: <Undo2 strokeWidth={1.75} />, params: { status: "RETURNED" } },
  { key: "overdue", label: "متأخرة", icon: <TriangleAlert strokeWidth={1.75} />, params: { overdue: "1" } },
];

export default async function SupervisorDashboard({ searchParams }: PageProps<"/supervisor">) {
  const user = await requireUser();
  const now = new Date();
  const askedTab = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === askedTab) ?? TABS[0];
  const listParams = (extra: Record<string, string>) => parseRequestListParams({ sort: "slaDueAt", dir: "asc", ...extra }, "queue");

  const [overview, overdue, queue, all, overdueQueue, counts, slaDays, tracks] = await Promise.all([
    getOverview(user, now),
    getOverdue(user, 5, now),
    listRequests(user, listParams(tab.params), "queue", now),
    listRequests(user, listParams({}), "queue", now),
    listRequests(user, listParams({ overdue: "1" }), "queue", now),
    requestStatusCounts(user, "queue"),
    getSetting("sla.workingDays"),
    getByTrack(user),
  ]);
  const hasPrograms = user.trackIds.length > 0;
  const countOf = (key: string) => counts.find((c) => c.key === key)?.count ?? 0;
  const tabCount = (t: (typeof TABS)[number]) => (t.key === "all" ? all.total : t.key === "overdue" ? overdueQueue.total : countOf(t.params.status));
  const next = all.items.find((r) => r.status.key === "UNDER_REVIEW") ?? all.items[0];

  return (
    <>
      <PageBand
        eyebrow={`${greeting(now)}، ${user.name}`}
        title="قائمة أعمالي"
        lead="الطلبات المسندة إليك والطلبات الواردة في المسارات التي تشرف عليها."
        actions={
          <>
            <BandDate date={now} />
            {next ? (
              <Link href={`${DETAIL}/${next.id}`} className={buttonClasses("primary")}>
                <Eye aria-hidden="true" />
                مراجعة الطلب التالي
              </Link>
            ) : null}
          </>
        }
        figures={
          <KpiRow
            items={[
              { label: "إجمالي الطلبات", icon: Inbox, featured: true, value: formatNumber(overview.total), caption: "في برامجي", href: "/supervisor/requests" },
              {
                label: "بانتظار قرارك",
                icon: Eye,
                tone: "review",
                value: formatNumber(overview.underReview),
                caption: "مقدَّمة أو قيد الفحص والمراجعة",
                href: "/supervisor?tab=review",
              },
              {
                label: "متأخرة",
                icon: TriangleAlert,
                tone: "bad",
                alert: overview.overdue > 0,
                value: formatNumber(overview.overdue),
                caption: "تجاوزت المهلة",
                href: "/supervisor?tab=overdue",
              },
              { label: "مقبولة", icon: CircleCheck, tone: "ok", value: formatNumber(overview.approved), caption: "في برامجي حتى الآن" },
            ]}
          />
        }
      />
      <PageBody className="flex flex-col gap-5">
        {!hasPrograms ? (
          <Alert tone="warning" icon={<TriangleAlert strokeWidth={1.75} className="!size-[22px]" />} title="لم تُسند إليك برامج بعد">
            لن تظهر لك أي طلبات حتى يُسند إليك مدير النظام برنامجًا واحدًا على الأقل.
          </Alert>
        ) : null}

        <RequestsTableCard
          title="طلبات قائمتي"
          description="مرتبة حسب أقرب مهلة"
          icon={<ListChecks strokeWidth={1.75} />}
          rows={queue.items.slice(0, 8)}
          total={queue.total}
          columns={["association", "program", "submitted", "status", "sla"]}
          hrefBase={DETAIL}
          listHref={QUEUE}
          now={now}
          actionLabel="مراجعة"
          tabs={
            <CardTabs
              label="تصفية قائمتي"
              items={TABS.map((t) => ({
                key: t.key,
                label: t.label,
                icon: t.icon,
                count: tabCount(t),
                href: t.key === "all" ? "/supervisor" : `/supervisor?tab=${t.key}`,
                active: t.key === tab.key,
              }))}
            />
          }
          empty={<EmptyQueue filtered={tab.key !== "all"} />}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <StatusDistributionCard rows={overview.byStatus} href="/supervisor/requests" />
          {/* The requests of the supervisor's programmes per track (D-119). */}
          <TracksCard data={tracks} />
        </div>
        <div>
          <OverdueCard
            rows={overdue}
            total={overview.overdue}
            slaDays={slaDays}
            now={now}
            hrefBase={DETAIL}
            listHref="/supervisor/requests?overdue=1&sort=slaDueAt&dir=asc"
          />
        </div>
      </PageBody>
    </>
  );
}

function EmptyQueue({ filtered }: { filtered: boolean }) {
  return (
    <CardEmpty
      icon={<Inbox strokeWidth={1.75} />}
      title={filtered ? "لا توجد طلبات في هذا التبويب" : "لا توجد طلبات في قائمتك"}
      action={
        filtered ? (
          <Link href="/supervisor" className={buttonClasses("outline", "sm")}>
            عرض الكل
          </Link>
        ) : null
      }
    >
      {filtered ? "لا توجد في قائمتك طلبات بهذه الحالة الآن." : "عند تقديم الجمعيات طلبات ضمن برامجك ستُسند إليك تلقائيًا وتظهر هنا مع مهلة مراجعة كل طلب."}
    </CardEmpty>
  );
}
