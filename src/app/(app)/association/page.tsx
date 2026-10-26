import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, CircleCheck, FilePlus2, FileText, FolderOpen, Inbox, Undo2 } from "lucide-react";
import { BandDate } from "@/components/dashboard/band-date";
import { RecentRequestsCard } from "@/components/dashboard/cards";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { RequestStepper } from "@/components/requests/request-stepper";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { RefNumber } from "@/components/ui/ref-number";
import { Alert, Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { SUPERVISION_STEPS } from "@/config/initiative";
import { formatNumber, greeting, toArabicDigits } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getOverview } from "@/server/services/dashboard";
import { listRequests, parseRequestListParams } from "@/server/services/requests/read";

export const metadata: Metadata = { title: "طلباتي" };

const ICON = { strokeWidth: 1.75 } as const;

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
                icon: <Inbox {...ICON} />,
                href: "/association/requests",
              },
              { label: "قيد المراجعة", value: formatNumber(overview.underReview), caption: "لدى الوحدة الإشرافية", icon: <FileText {...ICON} />, tone: "info" },
              {
                label: "معادة للتعديل",
                value: formatNumber(overview.returned),
                caption: "بانتظار تعديلكم",
                icon: <Undo2 {...ICON} />,
                tone: "warn",
                emphasis: overview.returned > 0,
                href: "/association/requests?status=RETURNED",
              },
              { label: "معتمدة", value: formatNumber(overview.approved), caption: "منذ تسجيل الجمعية", icon: <CircleCheck {...ICON} />, tone: "ok" },
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

        <QuickActions
          items={[
            { label: "طلب جديد", hint: "تقديم برنامج أو مشروع", href: "/association/requests/new", icon: <FilePlus2 {...ICON} /> },
            { label: "طلباتي", hint: "الطلبات والمسودات", href: "/association/requests", icon: <FileText {...ICON} /> },
            { label: "المستندات", hint: "النماذج المعتمدة للتنزيل", href: "/association/documents", icon: <FolderOpen {...ICON} />, tone: "gold" },
            { label: "دليل التقديم", hint: "مراحل الطلب حتى القرار", href: "#guide", icon: <BookOpenCheck {...ICON} />, tone: "gold" },
          ]}
        />

        {latest && latest.status.key !== "DRAFT" ? (
          <Panel>
            <PanelHeader
              icon={<FileText strokeWidth={1.75} />}
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
          <Panel id="guide" className="scroll-mt-40">
            <PanelHeader icon={<BookOpenCheck strokeWidth={1.75} />} tone="gold" title="دليل التقديم" description="رحلة الطلب في المنصة" />
            <ol className="flex flex-col px-6 pb-6">
              {SUPERVISION_STEPS.map((s, i) => (
                <li key={s.title} className="relative flex gap-3.5 pb-5 last:pb-0">
                  {i < SUPERVISION_STEPS.length - 1 ? <span aria-hidden="true" className="absolute start-[15px] top-9 h-[calc(100%-2.25rem)] w-0.5 bg-line" /> : null}
                  <span className="t-figure flex size-8 shrink-0 items-center justify-center rounded-full bg-band text-sm text-band-gold">{toArabicDigits(i + 1)}</span>
                  <span>
                    <span className="block text-sm font-bold text-ink">{s.title}</span>
                    <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-ink-muted">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
