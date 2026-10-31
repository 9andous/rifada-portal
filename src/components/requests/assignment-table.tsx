"use client";

import { UserRoundCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { RefNumber } from "@/components/ui/ref-number";
import { StatusText, type StatusTone } from "@/components/ui/surface";
import { DataTable, THead, Td, Th, Tr } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { requestsPhrase, toArabicDigits } from "@/lib/format";
import { ReassignDialog, type DialogRequest, type SupervisorChoice } from "./decision-dialog";

export type AssignmentRow = {
  id: string;
  referenceNo: string | null;
  title: string;
  track: { id: string; number: number; name: string } | null;
  association: string;
  status: { name: string; tone: StatusTone };
  submittedAt: Date | null;
  supervisor?: string | null;
};

/** Requests waiting for a (new) supervisor, with single and bulk reassignment (unit manager). */
export function AssignmentTable({ rows, supervisors, caption, max }: { rows: AssignmentRow[]; supervisors: SupervisorChoice[]; caption: string; max: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<{ requests: DialogRequest[]; trackIds: string[]; round: number } | null>(null);
  const chosen = rows.filter((r) => selected.includes(r.id));
  const open = (list: AssignmentRow[]) =>
    setDialog((d) => ({
      requests: list.map((r) => ({ id: r.id, title: r.title, referenceNo: r.referenceNo })),
      trackIds: [...new Set(list.flatMap((r) => (r.track ? [r.track.id] : [])))],
      round: (d?.round ?? 0) + 1,
    }));
  // Offer the supervisors of every selected track first; the server skips any mismatch anyway.
  const offered = !dialog
    ? supervisors
    : dialog.trackIds.length === 1
      ? supervisors.filter((s) => s.trackIds.includes(dialog.trackIds[0]))
      : [...supervisors].sort((a, b) => Number(dialog.trackIds.every((t) => b.trackIds.includes(t))) - Number(dialog.trackIds.every((t) => a.trackIds.includes(t))));

  return (
    <>
      {chosen.length ? (
        <div role="region" aria-label="الإجراءات الجماعية" className="flex flex-wrap items-center gap-3 border-y border-line bg-surface-sunken px-6 py-3">
          <span className="text-sm font-semibold text-ink">{requestsPhrase(chosen.length)} محددة</span>
          {chosen.length > max ? <span className="text-xs text-st-bad">الحد الأقصى للإجراء الجماعي {requestsPhrase(max)}.</span> : null}
          <div className="ms-auto flex gap-2">
            <Button size="sm" onClick={() => open(chosen)} disabled={chosen.length > max}>
              <UserRoundCog aria-hidden="true" strokeWidth={1.75} />
              إسناد المحدد
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              إلغاء التحديد
            </Button>
          </div>
        </div>
      ) : null}
      <DataTable caption={caption} minWidth="52rem">
        <THead>
          <th scope="col" className="w-10 py-2.5 ps-6">
            <input
              type="checkbox"
              aria-label="تحديد الكل"
              className="size-4 accent-[var(--primary)]"
              checked={rows.length > 0 && selected.length === rows.length}
              onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
            />
          </th>
          <Th>الطلب</Th>
          <Th>المسار</Th>
          <Th>الحالة</Th>
          {rows.some((r) => r.supervisor) ? <Th>المشرف الحالي</Th> : null}
          <Th>تاريخ التقديم</Th>
          <Th>
            <span className="sr-only">إجراءات</span>
          </Th>
        </THead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id} className={cn(selected.includes(r.id) && "bg-surface-sunken hover:bg-surface-sunken")}>
              <Td className="w-10">
                <input
                  type="checkbox"
                  aria-label={`تحديد ${r.title}`}
                  className="mt-1 size-4 accent-[var(--primary)]"
                  checked={selected.includes(r.id)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))}
                />
              </Td>
              <Td className="max-w-[24rem]">
                <Link href={`/manager/requests/${r.id}`} className="font-semibold text-ink hover:text-primary hover:underline">
                  {r.title}
                </Link>
                <span className="t-caption mt-0.5 flex flex-wrap items-center gap-x-2">
                  {r.referenceNo ? <RefNumber value={r.referenceNo} /> : null}
                  <span aria-hidden="true">·</span>
                  {r.association}
                </span>
              </Td>
              <Td className="max-w-[14rem]">
                <span className="block truncate">
                  {r.track ? `${toArabicDigits(r.track.number)}. ${r.track.name}` : "—"}
                </span>
              </Td>
              <Td>
                <StatusText tone={r.status.tone}>{r.status.name}</StatusText>
              </Td>
              {rows.some((x) => x.supervisor) ? <Td className="text-ink-subtle">{r.supervisor ?? "—"}</Td> : null}
              <Td className="whitespace-nowrap">
                <DateDisplay date={r.submittedAt} />
              </Td>
              <Td className="w-28">
                <Button size="sm" variant="outline" onClick={() => open([r])}>
                  إسناد
                </Button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>
      {dialog ? (
        <ReassignDialog
          key={dialog.round}
          open
          onOpenChange={(v) => !v && setDialog(null)}
          requests={dialog.requests}
          supervisors={offered}
          onDone={() => {
            setSelected([]);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
