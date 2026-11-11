import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, Clock, Eye, Flag, Inbox, ListChecks, TriangleAlert } from "lucide-react";
import { BandDate } from "@/components/dashboard/band-date";
import { CardEmpty, CardTabs, RequestsTableCard, StatusDistributionCard, TracksCard } from "@/components/dashboard/cards";
import { KpiRow } from "@/components/dashboard/kpis";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";
import { formatNumber, greeting } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getByTrack, getOverview } from "@/server/services/dashboard";
import { listRequests, parseRequestListParams } from "@/server/services/requests/read";

export const metadata: Metadata = { title: "لوحة المشرف" };

const DETAIL = "/supervisor/requests";
// «قائمة أعمالي» was folded into «قائمة الطلبات» (owner's review, D-130).
const QUEUE = "/supervisor/requests";

/**
 * Tabs of the requests card (owner's requests, D-127, D-143): the latest requests of the supervisor's
 * tracks, as on «قائمة الطلبات», newest submission first; and those of their own needing attention
 * (returned to the association, or past the review deadline), nearest deadline first.
 */
const TABS: { key: string; label: string; description: string; icon: ReactNode; view: "scope" | "queue"; params: Record<string, string> }[] = [
  { key: "recent", label: "الطلبات الأخيرة", description: "الأحدث تقديمًا في برامجك", icon: <Clock strokeWidth={1.75} />, view: "scope", params: { sort: "submittedAt", dir: "desc" } },
  { key: "priority", label: "ذات أولوية", description: "المعادة للتعديل والمتأخرة في قائمتك، الأقرب مهلة أولًا", icon: <Flag strokeWidth={1.75} />, view: "queue", params: { priority: "1", sort: "slaDueAt", dir: "asc" } },
];

/** «طلب جديد»، «طلبان جديدان»، «٣ طلبات جديدة»، «١١ طلبًا جديدًا». */
function newRequestsPhrase(n: number): string {
  if (n === 1) return "طلب جديد";
  if (n === 2) return "طلبان جديدان";
  if (n >= 3 && n <= 10) return `${formatNumber(n)} طلبات جديدة`;
  return `${formatNumber(n)} طلبًا جديدًا`;
}

export default async function SupervisorDashboard({ searchParams }: PageProps<"/supervisor">) {
  const user = await requireUser();
  const now = new Date();
  const askedTab = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === askedTab) ?? TABS[0];
  const listOf = (t: (typeof TABS)[number]) => listRequests(user, parseRequestListParams(t.params, t.view), t.view, now);

  const [overview, recent, priority, unopened, tracks] = await Promise.all([
    getOverview(user, now),
    listOf(TABS[0]),
    listOf(TABS[1]),
    listRequests(user, parseRequestListParams({ unopened: "1", sort: "submittedAt", dir: "asc" }, "queue"), "queue", now),
    getByTrack(user),
  ]);
  const shown = tab.key === "priority" ? priority : recent;
  const hasPrograms = user.trackIds.length > 0;
  const tabCount = (t: (typeof TABS)[number]) => (t.key === "priority" ? priority.total : recent.total);
  // One new request opens directly; several open the queue filtered to them.
  const unopenedHref = unopened.total === 1 ? `${DETAIL}/${unopened.items[0].id}` : `${QUEUE}?unopened=1`;

  return (
    <>
      <PageBand
        eyebrow={`${greeting(now)}، ${user.name}`}
        title="لوحة المشرف"
        lead="الطلبات الواردة في المسارات التي تشرف عليها."
        actions={<BandDate date={now} />}
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
                href: `${QUEUE}?status=UNDER_REVIEW`,
              },
              {
                label: "متأخرة",
                icon: TriangleAlert,
                tone: "bad",
                alert: overview.overdue > 0,
                value: formatNumber(overview.overdue),
                caption: "تجاوزت المهلة",
                href: `${QUEUE}?overdue=1`,
              },
              { label: "مقبولة", icon: CircleCheck, tone: "ok", value: formatNumber(overview.approved), caption: "في برامجي حتى الآن", href: `${QUEUE}?status=APPROVED` },
            ]}
          />
        }
      />
      <PageBody className="flex flex-col gap-5">
        {unopened.total > 0 ? (
          <Alert
            ruled
            tone="info"
            title={`${newRequestsPhrase(unopened.total)} بانتظار مراجعتك`}
            action={
              <Link href={unopenedHref} className={buttonClasses("primary", "sm")}>
                <Eye aria-hidden="true" />
                مراجعتها الآن
              </Link>
            }
          />
        ) : null}
        {!hasPrograms ? (
          <Alert ruled tone="warning" title="لم تُسند إليك برامج بعد">
            لن تظهر لك أي طلبات حتى يُسند إليك مدير النظام برنامجًا واحدًا على الأقل.
          </Alert>
        ) : null}

        <RequestsTableCard
          title="طلبات برامجي"
          description={tab.description}
          icon={<ListChecks strokeWidth={1.75} />}
          rows={shown.items.slice(0, 8)}
          total={shown.total}
          columns={["association", "program", "submitted", "status", "sla"]}
          hrefBase={DETAIL}
          listHref={QUEUE}
          now={now}
          // Any supervisor of the track reviews a request until it goes to the unit manager (D-144).
          actionLabel={(r) => (r.status.key === "UNDER_REVIEW" && !r.withManager ? "مراجعة" : "عرض")}
          tabs={
            <CardTabs
              label="تصفية الطلبات"
              items={TABS.map((t) => ({
                key: t.key,
                label: t.label,
                icon: t.icon,
                count: tabCount(t),
                href: t.key === TABS[0].key ? "/supervisor" : `/supervisor?tab=${t.key}`,
                active: t.key === tab.key,
              }))}
            />
          }
          empty={<EmptyQueue filtered={tab.key !== TABS[0].key} />}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <StatusDistributionCard rows={overview.byStatus} href="/supervisor/requests" />
          {/* The requests of the supervisor's programmes per track (D-119). */}
          <TracksCard data={tracks} />
        </div>
      </PageBody>
    </>
  );
}

function EmptyQueue({ filtered }: { filtered: boolean }) {
  return (
    <CardEmpty
      icon={<Inbox strokeWidth={1.75} />}
      title={filtered ? "لا توجد طلبات ذات أولوية" : "لا توجد طلبات في برامجك"}
      action={
        filtered ? (
          <Link href="/supervisor" className={buttonClasses("outline", "sm")}>
            عرض الكل
          </Link>
        ) : null
      }
    >
      {filtered ? "لا توجد في قائمتك طلبات معادة للتعديل أو متأخرة عن المهلة." : "عند تقديم الجمعيات طلبات ضمن برامجك تظهر هنا مع مهلة مراجعة كل طلب."}
    </CardEmpty>
  );
}
