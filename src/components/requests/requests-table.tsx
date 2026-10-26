import Link from "next/link";
import type { ReactNode } from "react";
import { PersonName } from "@/components/ui/avatar";
import { DateDisplay } from "@/components/ui/date-display";
import { RefNumber } from "@/components/ui/ref-number";
import { StatusText } from "@/components/ui/surface";
import { DataTable, Td, Tr } from "@/components/ui/table";
import { toArabicDigits } from "@/lib/format";
import type { RequestRow } from "@/server/services/requests/read";
import type { SupervisorChoice } from "./decision-dialog";
import { RequestSelection, RowActions, RowCheckbox, SelectAllCheckbox } from "./request-selection";

const SLA_KEYS = ["SUBMITTED", "COMPLETENESS_CHECK", "UNDER_REVIEW"];

/**
 * The requests table (change 16): status as dot plus text, initial circles, hover or focus row
 * actions (always visible on touch) for requests the viewer may decide, a checkbox column and a
 * selection bar for bulk actions with one shared reason. Rows render on the server; only the
 * checkboxes, actions and dialogs are client islands. Only decidable rows can be selected; the
 * server checks every request again and reports the skipped ones.
 */
export function RequestsTable({
  rows,
  detailBase,
  headers,
  showAssociation,
  showSupervisor,
  bulk,
}: {
  rows: RequestRow[];
  detailBase: string;
  /** Column headers (sortable ones included), after the checkbox column. */
  headers: ReactNode;
  showAssociation: boolean;
  showSupervisor: boolean;
  bulk: { enabled: boolean; max: number; supervisors: SupervisorChoice[] | null };
}) {
  const selectable = rows.filter((r) => r.decidable).map((r) => ({ id: r.id, title: r.title, referenceNo: r.referenceNo }));
  const table = (
    <DataTable caption="قائمة الطلبات" minWidth="56rem">
      <thead className="border-y border-line bg-surface-muted">
        <tr>
          {bulk.enabled ? (
            <th scope="col" className="w-10 py-3 ps-6">
              <SelectAllCheckbox />
            </th>
          ) : null}
          {headers}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.id} className="group">
            {bulk.enabled ? (
              <Td className="w-10">
                <RowCheckbox id={r.id} title={r.title} enabled={r.decidable} />
              </Td>
            ) : null}
            <Td className="min-w-[13rem] max-w-[22rem]">
              <Link href={`${detailBase}/${r.id}`} className="font-semibold text-ink hover:text-primary hover:underline">
                {r.title || "طلب بلا عنوان"}
              </Link>
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
              <span className="block truncate">
                {toArabicDigits(r.program.number)}. {r.program.name}
              </span>
              <span className="t-caption block truncate">
                {toArabicDigits(r.initiative.number)}. {r.initiative.name}
              </span>
            </Td>
            <Td>
              <StatusText tone={r.status.tone}>{r.status.name}</StatusText>
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
            <Td className="w-28 ps-0">{r.decidable ? <RowActions request={{ id: r.id, title: r.title, referenceNo: r.referenceNo }} /> : null}</Td>
          </Tr>
        ))}
      </tbody>
    </DataTable>
  );

  const decidable = rows.some((r) => r.decidable);
  return (
    <RequestSelection selectable={selectable} max={bulk.max} supervisors={bulk.enabled ? bulk.supervisors : null}>
      {table}
      {bulk.enabled && !decidable && rows.length > 0 ? <p className="t-caption px-6 pt-3">لا توجد في هذه الصفحة طلبات قيد المراجعة يمكنك القرار فيها.</p> : null}
    </RequestSelection>
  );
}
