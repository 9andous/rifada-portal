import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarClock, ChartColumn, CircleCheck, Clock, FileText, Layers, ListChecks, UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { RefNumber } from "@/components/ui/ref-number";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { daysPhrase, formatNumber, requestsPhrase, toArabicDigits } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MonthBucket, OverdueRow, ProgramRow, StatusRow, WorkloadRow } from "@/server/services/dashboard";
import type { RequestRow } from "@/server/services/requests/read";

// Dashboard cards (docs/DESIGN.md: Dashboards). Each one renders real figures and has its own
// designed empty state, so a dashboard with no data still looks finished.

/** Status colours per stable status key (fixed, separate from the chart palette). */
const STATUS_FILL: Record<string, string> = {
  SUBMITTED: "bg-st-info",
  COMPLETENESS_CHECK: "bg-st-info/55",
  UNDER_REVIEW: "bg-st-review",
  RETURNED: "bg-st-warn",
  APPROVED: "bg-st-ok",
  REJECTED: "bg-st-bad",
};

/** Small quiet note used inside cards when a block has no data yet. */
function CardEmpty({ icon, title, children, tone = "neutral" }: { icon: ReactNode; title: string; children?: ReactNode; tone?: "neutral" | "ok" }) {
  return (
    <div className="mx-6 mb-6 flex items-start gap-4 rounded-lg border border-line bg-surface-muted p-4">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md [&_svg]:size-5",
          tone === "ok" ? "bg-st-ok-soft text-st-ok" : "bg-surface-sunken text-ink-muted",
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-bold text-ink">{title}</p>
        {children ? <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-subtle">{children}</p> : null}
      </div>
    </div>
  );
}

function CardFooter({ children, href, label }: { children?: ReactNode; href?: string; label?: string }) {
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-line px-6 py-3 text-[0.8125rem] text-ink-subtle">
      <span>{children}</span>
      {href && label ? (
        <Link href={href} className={buttonClasses("ghost", "sm")}>
          {label}
          <ArrowLeft aria-hidden="true" />
        </Link>
      ) : null}
    </footer>
  );
}

export function StatusDistributionCard({ rows, href }: { rows: StatusRow[]; href?: string }) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <Panel className="flex flex-col">
      <PanelHeader icon={<ChartColumn strokeWidth={1.75} />} title="توزيع الطلبات حسب الحالة" description={requestsPhrase(total)} />
      <div className="flex-1 px-6 pb-5">
        <div
          role="img"
          aria-label={total ? rows.map((r) => `${r.name}: ${formatNumber(r.count)}`).join("، ") : "لا توجد طلبات"}
          className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-chart-track"
        >
          {total
            ? rows.filter((r) => r.count > 0).map((r) => (
                <span key={r.key} className={STATUS_FILL[r.key] ?? "bg-st-neutral"} style={{ width: `${(r.count / total) * 100}%` }} />
              ))
            : null}
        </div>
        <ul className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-2.5 border-b border-line/70 px-1 py-2.5 text-sm">
              <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-[3px]", STATUS_FILL[r.key] ?? "bg-st-neutral")} />
              <span className="text-ink-muted">{r.name}</span>
              <span className="t-figure ms-auto font-bold">{formatNumber(r.count)}</span>
              <span className="w-10 text-end text-xs text-ink-subtle">{total ? `${toArabicDigits(Math.round((r.count / total) * 100))}٪` : "—"}</span>
            </li>
          ))}
        </ul>
      </div>
      <CardFooter href={href} label={href ? "جميع الطلبات" : undefined}>
        {total === 0 ? "لم تُقدَّم طلبات بعد؛ سيظهر هنا توزيعها على مراحل المراجعة." : "حسب الحالة الحالية لكل طلب"}
      </CardFooter>
    </Panel>
  );
}

export function MonthlyCard({ months }: { months: MonthBucket[] }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  const total = months.reduce((n, m) => n + m.count, 0);
  return (
    <Panel className="flex flex-col">
      <PanelHeader icon={<CalendarClock strokeWidth={1.75} />} title="الطلبات الواردة شهريًا" description="آخر ستة أشهر هجرية" />
      <div className="flex-1 px-6 pb-5">
        <div className="flex h-44 items-end gap-3 border-b border-line-strong" role="img" aria-label={months.map((m) => `${m.name}: ${formatNumber(m.count)}`).join("، ")}>
          {months.map((m, i) => {
            const current = i === months.length - 1;
            return (
              <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className={cn("t-figure text-sm", current ? "font-bold text-accent-ink" : "text-ink-muted")}>{formatNumber(m.count)}</span>
                <span
                  className={cn("w-full max-w-11 rounded-t-md", current ? "bg-chart-2" : "bg-chart-1")}
                  style={{ height: m.count ? `${(m.count / max) * 120}px` : "3px" }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-3">
          {months.map((m) => (
            <span key={m.key} className="t-caption flex-1 truncate text-center">
              {m.name}
            </span>
          ))}
        </div>
      </div>
      <CardFooter>{total === 0 ? "لم ترد طلبات خلال الأشهر الستة الأخيرة." : `${requestsPhrase(total)} خلال الأشهر الستة`}</CardFooter>
    </Panel>
  );
}

export function ProgramsCard({ rows }: { rows: ProgramRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Panel className="flex flex-col">
      <PanelHeader icon={<Layers strokeWidth={1.75} />} title="الطلبات حسب البرنامج" description="برامج الرئاسة السبعة" />
      {rows.length === 0 ? (
        <CardEmpty icon={<Layers strokeWidth={1.75} />} title="لم تُحمَّل البرامج والمبادرات بعد">
          تُحمَّل برامج الرئاسة السبعة ومبادراتها ضمن البيانات المرجعية، وتظهر هنا بعدها أعداد الطلبات لكل برنامج.
        </CardEmpty>
      ) : (
        <ul className="flex flex-1 flex-col gap-3 px-6 pb-6">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[1.5rem_minmax(8rem,11rem)_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="t-figure flex size-6 items-center justify-center rounded-[6px] bg-surface-sunken text-xs text-ink-muted">{toArabicDigits(r.number)}</span>
              <span className="truncate text-ink-muted">{r.name.replace(/^برنامج /, "")}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-chart-track">
                <span className="block h-full rounded-full bg-chart-1" style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <span className="t-figure text-end font-bold">{formatNumber(r.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function WorkloadCard({ rows, unassigned, assignHref }: { rows: WorkloadRow[]; unassigned: number; assignHref?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.open));
  return (
    <Panel>
      <PanelHeader
        icon={<UsersRound strokeWidth={1.75} />}
        title="عبء العمل على المشرفين"
        description={`طلبات مفتوحة غير مسندة: ${formatNumber(unassigned)}`}
        actions={
          assignHref ? (
            <Link href={assignHref} className={buttonClasses("primary", "sm")}>
              إسناد الطلبات
            </Link>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <CardEmpty icon={<UsersRound strokeWidth={1.75} />} title="لا يوجد مشرفون نشطون بعد">
          يضيف مدير النظام حسابات المشرفين ويسند إليهم البرامج، ثم يظهر هنا توزيع الطلبات المفتوحة عليهم.
        </CardEmpty>
      ) : (
        <div className="-mt-5 overflow-x-auto">
          <table className="t-table w-full">
            <thead className="border-b border-line bg-surface-muted">
              <tr>
                <th scope="col" className="py-3 pe-4 ps-6 text-start text-[0.8125rem] font-semibold text-ink-muted">المشرف</th>
                <th scope="col" className="py-3 pe-4 text-end text-[0.8125rem] font-semibold text-ink-muted">مفتوحة</th>
                <th scope="col" className="py-3 pe-4 text-end text-[0.8125rem] font-semibold text-ink-muted">متأخرة</th>
                <th scope="col" className="w-56 py-3 pe-6 text-start text-[0.8125rem] font-semibold text-ink-muted">الحِمل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const share = r.open / max;
                return (
                  <tr key={r.id} className="border-b border-line/70 last:border-0 hover:bg-surface-muted">
                    <td className="py-3 pe-4 ps-6">
                      <span className="flex items-center gap-3">
                        <Avatar name={r.name} />
                        <span className="min-w-0">
                          <span className="block font-semibold">{r.name}</span>
                          <span className="t-caption block truncate">{r.programs.length ? r.programs.join("، ") : "لم تُسند إليه برامج"}</span>
                        </span>
                      </span>
                    </td>
                    <td className="py-3 pe-4 text-end font-semibold">{formatNumber(r.open)}</td>
                    <td className="py-3 pe-4 text-end">
                      {r.overdue ? <StatusText tone="bad">{formatNumber(r.overdue)}</StatusText> : <span className="text-ink-subtle">{formatNumber(0)}</span>}
                    </td>
                    <td className="py-3 pe-6">
                      <span className="flex items-center gap-3">
                        <span className="block h-2 flex-1 overflow-hidden rounded-full bg-chart-track">
                          <span className={cn("block h-full rounded-full", share > 0.75 ? "bg-st-warn" : "bg-primary")} style={{ width: `${share * 100}%` }} />
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function OverdueCard({ rows, total, slaDays, now, hrefBase }: { rows: OverdueRow[]; total: number; slaDays: number; now: Date; hrefBase?: string }) {
  return (
    <Panel className="flex flex-col">
      <PanelHeader
        icon={<Clock strokeWidth={1.75} />}
        tone={rows.length ? "gold" : "green"}
        title="طلبات تجاوزت مهلة المراجعة"
        description={`المهلة ${daysPhrase(slaDays)} عمل من تاريخ التقديم`}
        actions={total > rows.length ? <span className="t-caption">يُعرض {formatNumber(rows.length)} من {formatNumber(total)}</span> : null}
      />
      {rows.length === 0 ? (
        <CardEmpty icon={<CircleCheck strokeWidth={1.75} />} title="لا توجد طلبات متأخرة" tone="ok">
          جميع الطلبات المفتوحة ضمن مهلة المراجعة.
        </CardEmpty>
      ) : (
        <ul className="-mt-5 flex-1">
          {rows.map((r) => {
            const late = Math.max(1, Math.floor((now.getTime() - r.slaDueAt.getTime()) / DAY_MS));
            return (
              <li key={r.id} className="flex items-center gap-3.5 border-b border-line/70 px-6 py-3 last:border-0">
                <span className="flex size-[52px] shrink-0 flex-col items-center justify-center rounded-md bg-st-bad-soft leading-none text-st-bad">
                  <span className="t-figure text-xl font-bold">{formatNumber(late)}</span>
                  <span className="mt-1 text-[0.625rem]">يوم تأخير</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {hrefBase ? (
                      <Link href={`${hrefBase}/${r.id}`} className="hover:text-primary hover:underline">
                        {r.title}
                      </Link>
                    ) : (
                      r.title
                    )}
                  </p>
                  <p className="t-caption mt-0.5 flex flex-wrap items-center gap-x-2">
                    {r.referenceNo ? <RefNumber value={r.referenceNo} /> : null}
                    <span>{r.association}</span>
                  </p>
                </div>
                {r.supervisor ? (
                  <span className="hidden text-xs text-ink-muted sm:inline">{r.supervisor}</span>
                ) : (
                  <StatusText tone="warn">غير مسند</StatusText>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** The latest requests of the viewer's scope, with a link to the full list. */
export function RecentRequestsCard({
  rows,
  total,
  hrefBase,
  listHref,
  showAssociation,
  title = "آخر الطلبات",
  empty,
}: {
  rows: RequestRow[];
  total: number;
  hrefBase: string;
  listHref: string;
  showAssociation?: boolean;
  title?: string;
  empty: ReactNode;
}) {
  return (
    <Panel className="flex flex-col">
      <PanelHeader
        icon={<ListChecks strokeWidth={1.75} />}
        title={title}
        description={total ? `أحدث ${formatNumber(rows.length)} من ${formatNumber(total)}` : undefined}
        actions={
          total ? (
            <Link href={listHref} className={buttonClasses("outline", "sm")}>
              عرض الكل
            </Link>
          ) : null
        }
      />
      {rows.length === 0 ? (
        empty
      ) : (
        <ul className="-mt-5 flex-1">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-line/70 last:border-0">
              <Link href={`${hrefBase}/${r.id}`} className="group flex items-center gap-3.5 px-6 py-3.5 transition-colors hover:bg-surface-muted">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary [&_svg]:size-5">
                  <FileText strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink group-hover:text-primary">{r.title || "طلب بلا عنوان"}</span>
                  <span className="t-caption mt-0.5 flex flex-wrap items-center gap-x-2">
                    {r.referenceNo ? <RefNumber value={r.referenceNo} /> : <span>مسودة</span>}
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{showAssociation ? r.association : `${toArabicDigits(r.program.number)}. ${r.program.name}`}</span>
                  </span>
                </span>
                <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                  <StatusText tone={r.status.tone}>{r.status.name}</StatusText>
                  <DateDisplay date={r.submittedAt ?? r.updatedAt} className="t-caption" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
