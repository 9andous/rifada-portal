import Link from "next/link";
import type { ReactNode } from "react";
import { PersonName } from "@/components/ui/avatar";
import { DateDisplay } from "@/components/ui/date-display";
import { NewBadge } from "@/components/ui/new-badge";
import { RefNumber } from "@/components/ui/ref-number";
import { StatusText } from "@/components/ui/surface";
import { DataTable, ROW_LINK, Td, Tr } from "@/components/ui/table";
import { RECOMMENDATION_LABELS } from "@/lib/requests";
import type { RequestRow } from "@/server/services/requests/read";

const SLA_KEYS = ["SUBMITTED", "RESUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW"];

/**
 * The requests table (change 16, D-130): status as dot plus text, initial circles, and the whole row
 * opening the request. A row with something the viewer has not seen yet carries «جديد», and a request
 * with the unit manager shows the supervisor's recommendation (D-139). Decisions
 * are taken on the request page only (no checkboxes or bulk actions, owner's review).
 */
export function RequestsTable({
  rows,
  detailBase,
  headers,
  showAssociation,
  showSupervisor,
}: {
  rows: RequestRow[];
  detailBase: string;
  headers: ReactNode;
  showAssociation: boolean;
  showSupervisor: boolean;
}) {
  return (
    <DataTable caption="قائمة الطلبات" minWidth="56rem">
      <thead className="border-y border-line bg-surface-muted">
        <tr>{headers}</tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.id} linked>
            <Td className="min-w-[13rem] max-w-[22rem]">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {r.isNew ? <NewBadge /> : null}
                <Link href={`${detailBase}/${r.id}`} className={`font-semibold text-ink hover:text-primary hover:underline ${ROW_LINK}`}>
                  {r.title || "طلب بلا عنوان"}
                </Link>
              </span>
              <span className="t-caption mt-0.5 flex flex-wrap items-center gap-x-2">
                {r.referenceNo ? <RefNumber value={r.referenceNo} className="font-semibold text-primary" /> : <span>مسودة</span>}
                {showAssociation ? (
                  <>
                    <span aria-hidden="true">·</span>
                    {r.association}
                  </>
                ) : null}
              </span>
            </Td>
            <Td className="max-w-[13rem]">
              <span className="block truncate">{r.track ? r.track.name : "—"}</span>
              <span className="t-caption block truncate">{r.program ? r.program.name : (r.requestType ?? "")}</span>
            </Td>
            <Td>
              <StatusText tone={r.status.tone}>{r.status.name}</StatusText>
              {r.withManager ? (
                <span className="t-caption mt-1 block whitespace-nowrap">
                  بانتظار مدير الوحدة
                  {r.recommendation ? <span className="block">التوصية: {RECOMMENDATION_LABELS[r.recommendation]}</span> : null}
                </span>
              ) : null}
            </Td>
            {showSupervisor ? (
              <Td>{r.supervisor ? <PersonName name={r.supervisor.name} muted={!r.supervisor.isActive} /> : <span className="whitespace-nowrap text-ink-subtle">لم يُسند بعد</span>}</Td>
            ) : null}
            <Td className="min-w-[9.5rem]">{r.submittedAt ? <DateDisplay date={r.submittedAt} /> : <span className="text-ink-subtle">—</span>}</Td>
            <Td className="min-w-[9.5rem]">
              {r.slaDueAt && SLA_KEYS.includes(r.status.key) ? (
                <span className="inline-flex flex-col items-start gap-1">
                  <DateDisplay date={r.slaDueAt} className={r.overdue ? "text-st-bad" : undefined} />
                  {r.overdue ? <StatusText tone="bad">متأخر</StatusText> : null}
                </span>
              ) : (
                <span className="text-ink-subtle">—</span>
              )}
            </Td>
          </Tr>
        ))}
      </tbody>
    </DataTable>
  );
}
