import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ChartColumn,
  CircleCheck,
  Clock,
  Eye,
  LayoutGrid,
  Layers,
  ListChecks,
  PenLine,
  UserRound,
  UserRoundCheck,
  UsersRound,
  Waypoints,
} from "lucide-react";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { RefNumber } from "@/components/ui/ref-number";
import { Panel, PanelHeader, StatusText, type StatusTone } from "@/components/ui/surface";
import { daysPhrase, formatNumber, requestsPhrase, toArabicDigits } from "@/lib/format";
import { cn } from "@/lib/cn";
import { workingDaysBetween } from "@/lib/working-days";
import { MONTH_RANGES, SLA_KEYS, type MonthBucket, type OverdueRow, type ProgramRow, type StatusRow, type TrackRow, type WorkloadRow } from "@/server/services/dashboard";
import type { RequestRow } from "@/server/services/requests/read";

// Dashboard cards (docs/DESIGN.md: Dashboards), drawn after the design handoff: icon-tile headers,
// the stacked status bar, two-tone programme bars, grouped monthly bars, the workload table and
// request tables with deadline pills (D-097). Each renders real figures and has its own designed
// empty state, so a dashboard with no data still looks finished.

/** Status colours per stable status key (fixed, separate from the chart palette). */
const STATUS_FILL: Record<string, string> = {
  SUBMITTED: "bg-st-info",
  COMPLETENESS_CHECK: "bg-st-info/55",
  UNDER_REVIEW: "bg-st-review",
  RETURNED: "bg-st-warn",
  APPROVED: "bg-st-ok",
  REJECTED: "bg-st-bad",
};

/** Empty state inside a card: the handoff's arch with an icon, a title and a short sentence. */
export function CardEmpty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-8 pt-3 text-center">
      <span aria-hidden="true" className="relative mb-2 grid h-[86px] w-[72px] place-items-center text-primary [&>svg:last-child]:size-6">
        <svg viewBox="0 0 200 250" fill="none" className="absolute inset-0 size-full">
          <path d="M4 250 V118 C4 72 50 52 100 6 C150 52 196 72 196 118 V250" stroke="currentColor" strokeWidth="8" />
          <path d="M30 250 V128 C30 92 66 78 100 40 C134 78 170 92 170 128 V250" className="stroke-accent" strokeWidth="5" />
        </svg>
        {icon}
      </span>
      <p className="text-[0.9375rem] font-bold text-ink">{title}</p>
      {children ? <p className="max-w-[400px] text-sm leading-relaxed text-ink-muted">{children}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
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

/** A 34px bordered icon button that is a link (handoff `.ib.sm.bd`). */
function IconLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="flex size-[34px] shrink-0 items-center justify-center rounded-sm border border-line bg-surface text-ink-muted transition-colors hover:border-primary hover:text-primary [&_svg]:size-4"
    >
      {children}
    </Link>
  );
}

export function StatusDistributionCard({ rows, href }: { rows: StatusRow[]; href?: string }) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <Panel className="flex min-w-0 flex-col">
      <PanelHeader icon={<LayoutGrid strokeWidth={1.75} />} title="توزيع الطلبات حسب الحالة" description={requestsPhrase(total)} />
      <div className="flex-1 px-6 pb-5">
        <div
          role="img"
          aria-label={total ? rows.map((r) => `${r.name}: ${formatNumber(r.count)}`).join("، ") : "لا توجد طلبات"}
          className="flex h-3 gap-0.5 overflow-hidden rounded-[6px] bg-chart-track"
        >
          {total
            ? rows.filter((r) => r.count > 0).map((r) => (
                <span key={r.key} className={STATUS_FILL[r.key] ?? "bg-st-neutral"} style={{ width: `${(r.count / total) * 100}%` }} />
              ))
            : null}
        </div>
        <ul className="mt-3.5 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {rows.map((r) => {
            const body = (
              <>
                <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-[3px]", STATUS_FILL[r.key] ?? "bg-st-neutral")} />
                <span className="text-ink-muted">{r.name}</span>
                <span className="t-figure ms-auto font-bold">{formatNumber(r.count)}</span>
                <span className="w-10 text-end text-xs text-ink-subtle">{total ? `${toArabicDigits(Math.round((r.count / total) * 100))}٪` : "—"}</span>
              </>
            );
            return (
              <li key={r.key} className="border-b border-line/70">
                {href ? (
                  <Link href={`${href}?status=${r.key}`} className="flex items-center gap-2.5 px-2 py-2.5 text-sm transition-colors hover:bg-surface-muted">
                    {body}
                  </Link>
                ) : (
                  <span className="flex items-center gap-2.5 px-2 py-2.5 text-sm">{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <CardFooter href={href} label={href ? "جميع الطلبات" : undefined}>
        {total === 0 ? "لم تُقدَّم طلبات بعد؛ سيظهر هنا توزيعها على مراحل المراجعة." : href ? "انقر أي حالة لتصفية الطلبات بها." : "حسب الحالة الحالية لكل طلب"}
      </CardFooter>
    </Panel>
  );
}

function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-subtle">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-2.5 rounded-[3px]", i.className)} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Submitted and decided requests per Hijri month, with the 3 / 6 / 12 month switch. */
export function MonthlyCard({ months, range, rangeHref }: { months: MonthBucket[]; range: number; rangeHref: (months: number) => string }) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.count, m.decided)));
  const total = months.reduce((n, m) => n + m.count, 0);
  const dense = months.length > 6;
  return (
    <Panel className="flex min-w-0 flex-col">
      <PanelHeader
        icon={<ChartColumn strokeWidth={1.75} />}
        title="الطلبات الواردة شهريًا"
        description="مقارنة الوارد بما صدر فيه القرار"
        actions={
          <nav aria-label="مدة العرض" className="inline-flex gap-0.5 rounded-[9px] bg-surface-sunken p-[3px]">
            {MONTH_RANGES.map((n) => (
              <Link
                key={n}
                href={rangeHref(n)}
                scroll={false}
                aria-current={n === range ? "true" : undefined}
                className={cn(
                  "flex h-[30px] items-center rounded-[7px] px-3 text-[0.8125rem] font-medium",
                  n === range ? "bg-surface font-semibold text-ink shadow-1" : "text-ink-muted hover:text-ink",
                )}
              >
                {n === 12 ? "سنة" : `${toArabicDigits(n)} أشهر`}
              </Link>
            ))}
          </nav>
        }
      />
      <div className="flex-1 px-6 pb-5">
        <div
          className={cn("flex h-56 items-end border-b border-line pt-3", dense ? "gap-1.5" : "gap-4")}
          role="img"
          aria-label={months.map((m) => `${m.name}: وارد ${formatNumber(m.count)}، قرار ${formatNumber(m.decided)}`).join("؛ ")}
        >
          {months.map((m) => (
            <div key={m.key} className="flex h-full flex-1 items-end justify-center gap-1">
              {[
                { v: m.count, fill: "bg-chart-1", text: "text-ink-muted font-semibold" },
                { v: m.decided, fill: "bg-chart-2", text: "text-ink-subtle" },
              ].map((bar, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className={cn("t-figure text-[0.6875rem]", bar.text)}>{formatNumber(bar.v)}</span>
                  <span className={cn("block rounded-t-[4px]", bar.fill, dense ? "w-2.5" : "w-[18px]")} style={{ height: bar.v ? `${(bar.v / max) * 170}px` : "3px" }} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className={cn("mt-2 flex", dense ? "gap-1.5" : "gap-4")}>
          {months.map((m) => (
            <span key={m.key} className={cn("t-caption flex-1 truncate text-center", dense && "text-[0.625rem]")}>
              {m.name}
            </span>
          ))}
        </div>
        <div className="mt-3">
          <Legend
            items={[
              { label: "الوارد", className: "bg-chart-1" },
              { label: "صدر فيه القرار", className: "bg-chart-2" },
            ]}
          />
        </div>
      </div>
      <CardFooter>{total === 0 ? "لم ترد طلبات خلال هذه المدة." : `${requestsPhrase(total)} خلال المدة`}</CardFooter>
    </Panel>
  );
}

/** Requests per programme: decided (green) and open (gold) on one track. */
export function ProgramsCard({ rows, hrefBase }: { rows: ProgramRow[]; hrefBase?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Panel className="flex min-w-0 flex-col">
      <PanelHeader icon={<Layers strokeWidth={1.75} />} title="الطلبات حسب البرنامج" description="برامج الرئاسة السبعة" />
      {rows.length === 0 ? (
        <CardEmpty icon={<Layers strokeWidth={1.75} />} title="لم تُحمَّل البرامج والمبادرات بعد">
          تُحمَّل برامج الرئاسة السبعة ومبادراتها ضمن البيانات المرجعية، وتظهر هنا بعدها أعداد الطلبات لكل برنامج.
        </CardEmpty>
      ) : (
        <div className="flex flex-1 flex-col px-6 pb-5">
          <ul className="flex flex-col">
            {rows.map((r) => {
              const name = r.name.replace(/^برنامج /, "");
              return (
                <li key={r.id} className="grid grid-cols-[minmax(7rem,12.5rem)_1fr_2.75rem] items-center gap-3 py-[7px] text-sm">
                  {hrefBase ? (
                    <Link href={`${hrefBase}?program=${r.id}`} className="truncate text-ink-muted hover:text-primary hover:underline">
                      {name}
                    </Link>
                  ) : (
                    <span className="truncate text-ink-muted">{name}</span>
                  )}
                  <span
                    className="flex h-5 overflow-hidden rounded-[5px] bg-chart-track"
                    role="img"
                    aria-label={`${name}: منجزة ${formatNumber(r.decided)}، مفتوحة ${formatNumber(r.open)}`}
                  >
                    <span className="block h-full bg-chart-1" style={{ width: `${(r.decided / max) * 100}%` }} />
                    <span className="block h-full bg-chart-2" style={{ width: `${(r.open / max) * 100}%` }} />
                  </span>
                  <span className="t-figure text-end font-bold">{formatNumber(r.count)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3">
            <Legend
              items={[
                { label: "منجزة", className: "bg-chart-1" },
                { label: "مفتوحة", className: "bg-chart-2" },
              ]}
            />
          </div>
        </div>
      )}
    </Panel>
  );
}

/**
 * «التوزيع على المسارات» (D-119): submitted requests per track, largest first, each with a bar and
 * its open share; «غير مصنّفة» in gold when a programme sits in no track. Staff dashboards only.
 * The card is drawn on the green band so it stands apart from the white cards (owner's request).
 */
export function TracksCard({ data, tracksHref }: { data: { rows: TrackRow[]; unclassified: number; total: number }; tracksHref?: string }) {
  const rows = [...data.rows].sort((x, y) => y.count - x.count || x.number - y.number);
  const max = Math.max(1, data.unclassified, ...rows.map((r) => r.count));
  const bar = (label: string, value: number, fill: string) => (
    <span className="mt-1.5 block h-2.5 overflow-hidden rounded-full bg-white/15" role="img" aria-label={`${label}: ${formatNumber(value)} طلبات`}>
      <span className={cn("block h-full rounded-full", fill)} style={{ width: `${(value / max) * 100}%` }} />
    </span>
  );
  return (
    <section aria-labelledby="tracks-title" className="band-scope relative flex min-w-0 flex-col overflow-hidden rounded-xl bg-band text-band-ink shadow-2">
      <GeometricPattern size={56} />
      <header className="relative flex items-center gap-3 border-b border-white/15 px-5 py-4 sm:px-6">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-white/10 text-band-gold [&_svg]:size-[18px]">
          <Waypoints strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 id="tracks-title" className="t-section leading-snug text-band-ink">
            التوزيع على المسارات
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-band-ink-muted">المجموعة التاسعة · الطلبات المقدَّمة</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="relative px-6 py-8 text-sm text-band-ink-muted">يضيف مدير النظام المسارات، فتظهر هنا أعداد الطلبات في كل مسار.</p>
      ) : (
        <div className="relative flex flex-1 flex-col px-6 py-5">
          <ul className="flex flex-col gap-3.5">
            {rows.map((r) => (
              <li key={r.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 font-semibold text-band-ink">{r.name}</span>
                  <span className="shrink-0 text-band-ink-muted">
                    <span className="t-figure text-base font-bold text-band-ink">{formatNumber(r.count)}</span>
                    {r.open ? <span className="ms-1.5 text-xs">({formatNumber(r.open)} مفتوحة)</span> : null}
                  </span>
                </div>
                {bar(r.name, r.count, "bg-white")}
              </li>
            ))}
            {data.unclassified ? (
              <li>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  {tracksHref ? (
                    <Link href={tracksHref} className="font-semibold text-band-gold hover:underline">
                      غير مصنّفة
                    </Link>
                  ) : (
                    <span className="font-semibold text-band-gold">غير مصنّفة</span>
                  )}
                  <span className="t-figure text-base font-bold text-band-ink">{formatNumber(data.unclassified)}</span>
                </div>
                {bar("غير مصنّفة", data.unclassified, "bg-band-gold")}
              </li>
            ) : null}
          </ul>
          <p className="mt-4 text-xs text-band-ink-muted">يُحسب الطلب في المسار الذي اختارته الجمعية. إجمالي الطلبات المقدَّمة: {formatNumber(data.total)}.</p>
        </div>
      )}
    </section>
  );
}

const TH = "relative py-[11px] px-3.5 text-start text-[0.875rem] font-bold whitespace-nowrap text-ink first:ps-6 last:pe-6";
const TD = "px-3.5 py-3 align-middle first:ps-6 last:pe-6";

export function WorkloadCard({ rows, unassigned, assignHref, requestsHref }: { rows: WorkloadRow[]; unassigned: number; assignHref?: string; requestsHref?: string }) {
  const totalOpen = rows.reduce((n, r) => n + r.open, 0);
  return (
    <Panel className="min-w-0">
      <PanelHeader
        icon={<UsersRound strokeWidth={1.75} />}
        title="عبء العمل على المشرفين"
        description={`طلبات مفتوحة غير مسندة: ${formatNumber(unassigned)}`}
        actions={
          assignHref ? (
            <Link href={assignHref} className={buttonClasses("primary", "sm")}>
              <UserRoundCheck aria-hidden="true" />
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
        <div className="-mt-5 overflow-x-auto" data-table>
          <table className="t-table w-full min-w-[52rem]">
            <thead className="border-b border-line bg-surface-muted">
              <tr>
                <th scope="col" className={TH}>المشرف</th>
                <th scope="col" className={TH}>البرامج المسندة</th>
                <th scope="col" className={TH}>مفتوحة</th>
                <th scope="col" className={TH}>متأخرة</th>
                <th scope="col" className={cn(TH, "w-[24%]")}>الحِمل</th>
                <th scope="col" className={cn(TH, "text-end")}>
                  <span className="sr-only">إجراءات</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const share = totalOpen ? r.open / totalOpen : 0;
                return (
                  <tr key={r.id} className="border-b border-line/70 last:border-0 hover:bg-surface-muted">
                    <td className={TD}>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={r.name} />
                        <span>
                          <span className="block font-semibold leading-tight">{r.name}</span>
                          <span className="t-caption">مشرف مسارات</span>
                        </span>
                      </span>
                    </td>
                    <td className={cn(TD, "max-w-72 text-sm text-ink-muted")}>
                      <span className="line-clamp-2">{r.tracks.length ? r.tracks.join("، ") : "لم تُسند إليه مسارات"}</span>
                    </td>
                    <td className={cn(TD, "t-figure font-bold")}>{formatNumber(r.open)}</td>
                    <td className={TD}>{r.overdue ? <StatusText tone="bad">{formatNumber(r.overdue)}</StatusText> : <span className="text-ink-subtle">{formatNumber(0)}</span>}</td>
                    <td className={TD}>
                      <span className="flex items-center gap-2.5">
                        <span className="block h-2 min-w-20 flex-1 overflow-hidden rounded-[6px] bg-chart-track">
                          <span className={cn("block h-full rounded-[6px]", share > 0.75 ? "bg-st-warn" : "bg-primary")} style={{ width: `${share * 100}%` }} />
                        </span>
                        <span className="t-figure w-10 text-xs text-ink-subtle">{totalOpen ? `${toArabicDigits(Math.round(share * 100))}٪` : "—"}</span>
                      </span>
                    </td>
                    <td className={TD}>
                      {requestsHref ? (
                        <span className="flex justify-end">
                          <IconLink href={`${requestsHref}?supervisor=${r.id}`} label={`طلبات ${r.name}`}>
                            <Eye strokeWidth={1.75} />
                          </IconLink>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length ? <CardFooter>الحِمل: نصيب المشرف من الطلبات المفتوحة المسندة.</CardFooter> : null}
    </Panel>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function OverdueCard({
  rows,
  total,
  slaDays,
  now,
  hrefBase,
  assignHref,
  listHref,
}: {
  rows: OverdueRow[];
  total: number;
  slaDays: number;
  now: Date;
  hrefBase?: string;
  /** Unassigned rows get an assign button (unit manager). */
  assignHref?: string;
  listHref?: string;
}) {
  return (
    <Panel className="flex min-w-0 flex-col">
      <PanelHeader
        icon={<Clock strokeWidth={1.75} />}
        title="طلبات تجاوزت مهلة المراجعة"
        description={`المهلة ${daysPhrase(slaDays)} عمل من تاريخ التقديم`}
        actions={total > rows.length ? <span className="t-caption">يُعرض {formatNumber(rows.length)} من {formatNumber(total)}</span> : null}
      />
      {rows.length === 0 ? (
        <CardEmpty icon={<CircleCheck strokeWidth={1.75} />} title="لا توجد طلبات متأخرة">
          جميع الطلبات المفتوحة ضمن مهلة المراجعة.
        </CardEmpty>
      ) : (
        <ul className="-mt-5 flex-1">
          {rows.map((r) => {
            const late = Math.max(1, workingDaysBetween(r.slaDueAt, now) || Math.floor((now.getTime() - r.slaDueAt.getTime()) / DAY_MS));
            return (
              <li key={r.id} className="flex items-center gap-3 border-b border-line/70 px-6 py-3 last:border-0">
                <span className="flex size-[52px] shrink-0 flex-col items-center justify-center rounded-md bg-st-bad-soft leading-none text-st-bad">
                  <span className="t-figure text-xl font-bold">{formatNumber(late)}</span>
                  <span className="mt-1 text-[0.625rem]">يوم تأخير</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-bold">{r.association}</p>
                  <p className="t-caption mt-0.5 flex min-w-0 items-center gap-x-1.5">
                    {r.referenceNo ? <RefNumber value={r.referenceNo} /> : null}
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{r.title}</span>
                  </p>
                </div>
                {r.supervisor ? (
                  <span className="hidden items-center gap-1 rounded-[6px] bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted sm:inline-flex">
                    <UserRound aria-hidden="true" className="size-3" strokeWidth={1.75} />
                    {r.supervisor}
                  </span>
                ) : (
                  <StatusText tone="warn">غير مسند</StatusText>
                )}
                {hrefBase ? (
                  <IconLink href={`${hrefBase}/${r.id}`} label="فتح الطلب">
                    <Eye strokeWidth={1.75} />
                  </IconLink>
                ) : null}
                {!r.supervisor && assignHref ? (
                  <IconLink href={assignHref} label="إسناد">
                    <UserRoundCheck strokeWidth={1.75} />
                  </IconLink>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {listHref && total > 0 ? <CardFooter href={listHref} label="جميع المتأخرة">الأقدم تأخرًا أولًا</CardFooter> : null}
    </Panel>
  );
}

/** Deadline of an open request as a pill: late in red, two working days or less in amber. */
export function SlaPill({ row, now }: { row: Pick<RequestRow, "slaDueAt" | "status">; now: Date }) {
  if (!row.slaDueAt || !(SLA_KEYS as readonly string[]).includes(row.status.key)) return <span className="text-ink-subtle">—</span>;
  if (row.slaDueAt < now) {
    const late = Math.max(1, workingDaysBetween(row.slaDueAt, now));
    return <StatusText tone="bad">متأخر {daysPhrase(late)}</StatusText>;
  }
  const left = workingDaysBetween(now, row.slaDueAt);
  const tone: StatusTone = left <= 2 ? "warn" : "neutral";
  return <StatusText tone={tone}>{left === 0 ? "تنتهي اليوم" : `متبقٍ ${daysPhrase(left)}`}</StatusText>;
}

type Column = "association" | "title" | "program" | "submitted" | "status" | "sla";

/** Requests as a table (handoff queue and association lists) with a «مراجعة» / «عرض» / «تعديل» action per row. */
export function RequestsTableCard({
  title,
  description,
  icon = <ListChecks strokeWidth={1.75} />,
  rows,
  total,
  columns,
  hrefBase,
  listHref,
  now,
  actionLabel = "عرض",
  editHref,
  tools,
  tabs,
  empty,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  rows: RequestRow[];
  total: number;
  columns: Column[];
  hrefBase: string;
  listHref: string;
  now: Date;
  actionLabel?: string;
  /** Returned requests get a gold «تعديل» button to this edit page (association). */
  editHref?: (id: string) => string;
  tools?: ReactNode;
  tabs?: ReactNode;
  empty: ReactNode;
}) {
  return (
    <Panel className="flex min-w-0 flex-col">
      <PanelHeader icon={icon} title={title} description={description} actions={tools} className={tabs ? "mb-0" : undefined} />
      {tabs}
      {rows.length === 0 ? (
        <div className={tabs ? "pt-6" : undefined}>{empty}</div>
      ) : (
        <>
          <div className={cn("overflow-x-auto", !tabs && "-mt-5")} data-table>
            <table className="t-table w-full min-w-[56rem]">
              <thead className="border-b border-line bg-surface-muted">
                <tr>
                  <th scope="col" className={TH}>رقم الطلب</th>
                  {columns.includes("association") ? <th scope="col" className={TH}>الجمعية</th> : null}
                  {columns.includes("title") ? <th scope="col" className={TH}>اسم المشروع</th> : null}
                  {columns.includes("program") ? <th scope="col" className={TH}>المسار</th> : null}
                  {columns.includes("submitted") ? <th scope="col" className={TH}>تاريخ التقديم</th> : null}
                  {columns.includes("status") ? <th scope="col" className={TH}>الحالة</th> : null}
                  {columns.includes("sla") ? <th scope="col" className={TH}>المهلة</th> : null}
                  <th scope="col" className={cn(TH, "text-end")}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const edit = editHref && r.status.key === "RETURNED";
                  return (
                    <tr key={r.id} className="border-b border-line/70 last:border-0 hover:bg-surface-muted">
                      <td className={TD}>
                        <Link href={`${hrefBase}/${r.id}`} className="font-semibold text-primary hover:underline">
                          {r.referenceNo ? <RefNumber value={r.referenceNo} /> : "مسودة"}
                        </Link>
                      </td>
                      {columns.includes("association") ? (
                        <td className={TD}>
                          <span className="flex items-center gap-2.5">
                            <Avatar name={r.association} />
                            <span className="font-semibold">{r.association}</span>
                          </span>
                        </td>
                      ) : null}
                      {columns.includes("title") ? <td className={cn(TD, "max-w-72 font-semibold")}><span className="line-clamp-2">{r.title || "طلب بلا عنوان"}</span></td> : null}
                      {columns.includes("program") ? <td className={cn(TD, "text-sm text-ink-muted")}>{r.track?.name ?? "—"}</td> : null}
                      {columns.includes("submitted") ? (
                        <td className={cn(TD, "text-sm text-ink-muted")}>{r.submittedAt ? <DateDisplay date={r.submittedAt} /> : "—"}</td>
                      ) : null}
                      {columns.includes("status") ? (
                        <td className={TD}>
                          <StatusText tone={r.status.tone}>{r.status.name}</StatusText>
                        </td>
                      ) : null}
                      {columns.includes("sla") ? (
                        <td className={TD}>
                          <SlaPill row={r} now={now} />
                        </td>
                      ) : null}
                      <td className={cn(TD, "text-end")}>
                        {edit ? (
                          <Link href={editHref(r.id)} className={buttonClasses("gold", "sm")}>
                            <PenLine aria-hidden="true" />
                            تعديل
                          </Link>
                        ) : (
                          <Link href={`${hrefBase}/${r.id}`} className={buttonClasses("outline", "sm")}>
                            <Eye aria-hidden="true" />
                            {actionLabel}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <CardFooter href={listHref} label="عرض الكل">
            عرض {formatNumber(rows.length)} من {formatNumber(total)}
          </CardFooter>
        </>
      )}
    </Panel>
  );
}

/** Tab row inside a card (handoff `.tabs`): icon, label and a count chip; each tab is a link. */
export function CardTabs({ items, label }: { items: { key: string; label: string; count: number; href: string; active: boolean; icon: ReactNode }[]; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line px-5">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "relative inline-flex h-12 shrink-0 items-center gap-2 px-3.5 text-sm whitespace-nowrap [&_svg]:size-4",
            t.active
              ? "font-semibold text-primary after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-t-[3px] after:bg-primary"
              : "font-medium text-ink-muted hover:text-ink",
          )}
        >
          {t.icon}
          {t.label}
          <span className={cn("t-figure rounded-[10px] px-[7px] text-xs leading-[18px] font-semibold", t.active ? "bg-primary text-primary-ink" : "bg-surface-sunken text-ink-muted")}>
            {formatNumber(t.count)}
          </span>
        </Link>
      ))}
    </nav>
  );
}
