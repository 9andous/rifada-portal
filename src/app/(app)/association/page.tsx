import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { BandDate } from "@/components/dashboard/band-date";
import { RecentRequestsCard } from "@/components/dashboard/cards";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { RequestStepper } from "@/components/requests/request-stepper";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { RefNumber } from "@/components/ui/ref-number";
import { Alert, Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { Timeline, TimelineItem, TimelineText, TimelineTitle } from "@/components/ui/timeline";
import { SUPERVISION_STEPS } from "@/config/initiative";
import { formatNumber, greeting } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getOverview } from "@/server/services/dashboard";
import { listRequests, parseRequestListParams } from "@/server/services/requests/read";

export const metadata: Metadata = { title: "طلباتي" };


export default async function AssociationDashboard() {
  const user = await requireUser();
  const now = new Date();
  const [overview, recent] = await Promise.all([
    getOverview(user, now),
    listRequests(user, parseRequestListParams({ sort: "updatedAt", dir: "desc" }, "mine"), "mine", now),
  ]);
  const latest = recent.items.find((r) => r.status.key !== "DRAFT") ?? recent.items[0];
  const returned = recent.items.find((r) => r.status.key === "RETURNED");

  return (
    <>
      <PageBand
        eyebrow={`${greeting(now)}، ${user.name}`}
        title={user.associationName ?? "طلبات الجمعية"}
        lead="متابعة طلبات جمعيتكم المقدمة إلى الوحدة الإشرافية ومراحل مراجعتها."
        actions={
          <>
            <BandDate date={now} />
            <Link href="/association/requests/new" className={buttonClasses("primary")}>
              <FilePlus2 aria-hidden="true" />
              تقديم طلب جديد
            </Link>
          </>
        }
        figures={
          <BandFigures
            items={[
              {
                label: "الطلبات المقدَّمة",
                value: formatNumber(overview.total),
                caption: overview.drafts ? `مسودات غير مقدَّمة: ${formatNumber(overview.drafts)}` : "لا توجد مسودات",
                href: "/association/requests",
              },
              { label: "قيد المراجعة", value: formatNumber(overview.underReview), caption: "لدى الوحدة الإشرافية" },
              {
                label: "معادة للتعديل",
                value: formatNumber(overview.returned),
                caption: "بانتظار تعديلكم",
                attention: overview.returned > 0 && "warn",
                href: "/association/requests?status=RETURNED",
              },
              { label: "معتمدة", value: formatNumber(overview.approved), caption: "منذ تسجيل الجمعية" },
            ]}
          />
        }
      />
      <PageBody className="flex flex-col gap-5">
        {returned ? (
          <Alert
            tone="warning"
            title="طلب يحتاج إلى تعديلكم"
            action={
              <Link href={`/association/requests/${returned.id}`} className={buttonClasses("gold", "sm")}>
                عرض الملاحظات وتعديل الطلب
              </Link>
            }
          >
            أعاد المشرف الطلب «{returned.title}» للتعديل. اطّلعوا على الملاحظات ثم أعيدوا تقديمه.
          </Alert>
        ) : null}

        {latest && latest.status.key !== "DRAFT" ? (
          <Panel>
            <PanelHeader
              title="آخر طلب مقدَّم"
              description={
                <span className="flex flex-wrap items-center gap-x-2">
                  {latest.referenceNo ? <RefNumber value={latest.referenceNo} /> : null}
                  <span>{latest.title}</span>
                </span>
              }
              actions={
                <>
                  <StatusText tone={latest.status.tone}>{latest.status.name}</StatusText>
                  <Link href={`/association/requests/${latest.id}`} className={buttonClasses("outline", "sm")}>
                    تفاصيل الطلب
                  </Link>
                </>
              }
            />
            <div className="px-6 pb-7 pt-1">
              <RequestStepper statusKey={latest.status.key} />
            </div>
          </Panel>
        ) : null}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          <RecentRequestsCard
            title="طلبات الجمعية"
            rows={recent.items.slice(0, 6)}
            total={recent.total}
            hrefBase="/association/requests"
            listHref="/association/requests"
            empty={
              <EmptyState
                variant="inline"
                icon={<FilePlus2 strokeWidth={1.75} />}
                title="لم تقدّموا أي طلب بعد"
                description="يمكنكم تقديم طلب برنامج أو مشروع ضمن برامج الرئاسة، وستظهر هنا حالته ومراحل مراجعته."
                action={
                  <Link href="/association/requests/new" className={buttonClasses("primary")}>
                    <FilePlus2 aria-hidden="true" />
                    تقديم طلب جديد
                  </Link>
                }
              />
            }
          />
          <Panel id="guide" className="scroll-mt-28 lg:scroll-mt-44">
            <PanelHeader title="دليل التقديم" description="رحلة الطلب في المنصة" />
            <Timeline className="px-6 pb-6">
              {SUPERVISION_STEPS.map((s) => (
                <TimelineItem key={s.title}>
                  <TimelineTitle>{s.title}</TimelineTitle>
                  <TimelineText>{s.text}</TimelineText>
                </TimelineItem>
              ))}
            </Timeline>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
