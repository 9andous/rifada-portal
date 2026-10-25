import Link from "next/link";
import type { ReactNode } from "react";
import { CircleCheck, Layers, UsersRound } from "lucide-react";
import { RefNumber } from "@/components/ui/ref-number";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { daysPhrase, formatNumber, requestsPhrase } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MonthBucket, OverdueRow, ProgramRow, StatusRow, WorkloadRow } from "@/server/services/dashboard";

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
    <div className="flex items-start gap-4 px-6 pb-6 pt-2">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-sm [&_svg]:size-5",
          tone === "ok" ? "bg-st-ok-soft text-st-ok" : "bg-surface-sunken text-ink-muted",
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-bold text-ink">{title}</p>
        {children ? <p className="t-caption mt-0.5 text-[0.8125rem]">{children}</p> : null}
      </div>
    </div>
  );
}

export function StatusDistributionCard({ rows }: { rows: StatusRow[] }) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <Panel>
      <PanelHeader title="توزيع الطلبات حسب الحالة" actions={<span className="t-caption">{requestsPhrase(total)}</span>} />
      <div className="px-6 pb-6">
        <div
          role="img"
          aria-label={total ? rows.map((r) => `${r.name}: ${formatNumber(r.count)}`).join("، ") : "لا توجد طلبات"}
          className="flex h-3 overflow-hidden rounded-sm bg-chart-track"
        >
          {total
            ? rows.filter((r) => r.count > 0).map((r) => (
                <span key={r.key} className={STATUS_FILL[r.key] ?? "bg-st-neutral"} style={{ width: `${(r.count / total) * 100}%` }} />
              ))
            : null}
        </div>
        <ul className="mt-5 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2.5 text-sm text-ink-muted">
                <span aria-hidden="true" className={cn("size-2.5 rounded-full", STATUS_FILL[r.key] ?? "bg-st-neutral")} />
                {r.name}
              </span>
              <span className="t-figure text-lg">{formatNumber(r.count)}</span>
            </li>
          ))}
        </ul>
        {total === 0 ? <p className="t-caption mt-3">لم تُقدَّم طلبات بعد؛ سيظهر هنا توزيعها على مراحل المراجعة.</p> : null}
      </div>
    </Panel>
  );
}

export function MonthlyCard({ months }: { months: MonthBucket[] }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  const total = months.reduce((n, m) => n + m.count, 0);
  return (
    <Panel>
      <PanelHeader title="الطلبات الواردة شهريًا" actions={<span className="t-caption">آخر ستة أشهر هجرية</span>} />
      <div className="px-6 pb-6">
        <div className="flex h-44 items-end gap-3 border-b border-line-strong" role="img" aria-label={months.map((m) => `${m.name}: ${formatNumber(m.count)}`).join("، ")}>
          {months.map((m, i) => {
            const current = i === months.length - 1;
            return (
              <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className={cn("t-figure text-sm", current ? "text-accent-ink" : "text-ink-muted")}>{formatNumber(m.count)}</span>
                <span
                  className={cn("w-full max-w-12 rounded-t-sm", current ? "bg-chart-2" : "bg-chart-1")}
                  style={{ height: m.count ? `${(m.count / max) * 120}px` : "2px" }}
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
        {total === 0 ? <p className="t-caption mt-4">لم ترد طلبات خلال الأشهر الستة الأخيرة.</p> : null}
      </div>
    </Panel>
  );
}

export function ProgramsCard({ rows }: { rows: ProgramRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Panel>
      <PanelHeader title="الطلبات حسب البرنامج" />
      {rows.length === 0 ? (
        <CardEmpty icon={<Layers strokeWidth={1.75} />} title="لم تُحمَّل البرامج والمبادرات بعد">
          تُحمَّل برامج الرئاسة السبعة ومبادراتها ضمن البيانات المرجعية، وتظهر هنا بعدها أعداد الطلبات لكل برنامج.
        </CardEmpty>
      ) : (
        <ul className="flex flex-col gap-3.5 px-6 pb-6">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[minmax(8rem,11rem)_1fr_3rem] items-center gap-4 text-sm">
              <span className="truncate text-ink-muted">{r.name.replace(/^برنامج /, "")}</span>
              <span className="h-2 rounded-sm bg-chart-track">
                <span className="block h-2 rounded-sm bg-chart-3" style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <span className="t-figure text-end">{formatNumber(r.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function WorkloadCard({ rows, unassigned }: { rows: WorkloadRow[]; unassigned: number }) {
  const max = Math.max(1, ...rows.map((r) => r.open));
  return (
    <Panel>
      <PanelHeader
        title="عبء العمل على المشرفين"
        actions={<span className="t-caption">طلبات مفتوحة غير مسندة: {formatNumber(unassigned)}</span>}
      />
      {rows.length === 0 ? (
        <CardEmpty icon={<UsersRound strokeWidth={1.75} />} title="لا يوجد مشرفون نشطون بعد">
          يضيف مدير النظام حسابات المشرفين ويسند إليهم البرامج، ثم يظهر هنا توزيع الطلبات المفتوحة عليهم.
        </CardEmpty>
      ) : (
        <div className="overflow-x-auto px-6 pb-4">
          <table className="t-table w-full">
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="t-label py-2.5 pe-4 text-start">المشرف</th>
                <th scope="col" className="t-label py-2.5 pe-4 text-end">مفتوحة</th>
                <th scope="col" className="t-label py-2.5 pe-4 text-end">متأخرة</th>
                <th scope="col" className="t-label w-48 py-2.5 text-start">الحمل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="py-3 pe-4">
                    <span className="flex items-center gap-3">
                      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-xs font-bold text-ink-muted">
                        {r.name.trim().charAt(0)}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{r.name}</span>
                        <span className="t-caption block truncate">{r.programs.length ? r.programs.join("، ") : "لم تُسند إليه برامج"}</span>
                      </span>
                    </span>
                  </td>
                  <td className="py-3 pe-4 text-end font-semibold">{formatNumber(r.open)}</td>
                  <td className={cn("py-3 pe-4 text-end", r.overdue ? "font-semibold text-st-bad" : "text-ink-subtle")}>{formatNumber(r.overdue)}</td>
                  <td className="py-3">
                    <span className="block h-2 rounded-sm bg-chart-track">
                      <span className="block h-2 rounded-sm bg-chart-4" style={{ width: `${(r.open / max) * 100}%` }} />
                    </span>
                  </td>
                </tr>
              ))}
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
    <Panel>
      <PanelHeader
        title="طلبات تجاوزت مهلة المراجعة"
        description={`المهلة ${daysPhrase(slaDays)} عمل من تاريخ التقديم`}
        actions={total > rows.length ? <span className="t-caption">يُعرض {formatNumber(rows.length)} من {formatNumber(total)}</span> : null}
      />
      {rows.length === 0 ? (
        <CardEmpty icon={<CircleCheck strokeWidth={1.75} />} title="لا توجد طلبات متأخرة" tone="ok">
          جميع الطلبات المفتوحة ضمن مهلة المراجعة.
        </CardEmpty>
      ) : (
        <ul className="px-6 pb-3">
          {rows.map((r) => {
            const late = Math.max(1, Math.floor((now.getTime() - r.slaDueAt.getTime()) / DAY_MS));
            return (
              <li key={r.id} className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
                <div className="min-w-0">
                  <p className="t-caption">{r.referenceNo ? <RefNumber value={r.referenceNo} /> : "—"}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold">
                    {hrefBase ? (
                      <Link href={`${hrefBase}/${r.id}`} className="hover:text-primary hover:underline">
                        {r.title}
                      </Link>
                    ) : (
                      r.title
                    )}
                  </p>
                  <p className="t-caption truncate">
                    {r.association} · {r.supervisor ?? "غير مسند"}
                  </p>
                </div>
                <StatusText tone="bad" className="shrink-0 text-xs">
                  متأخر {daysPhrase(late, "accusative")}
                </StatusText>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

