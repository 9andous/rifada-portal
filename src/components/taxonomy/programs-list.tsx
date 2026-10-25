import Link from "next/link";
import { EmptyState } from "@/components/states/states";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { SortHeader } from "@/components/ui/sort-header";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { DataTable, SORT_TH, THead, Td, Th, Tr } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import type { SearchParams } from "@/lib/list-params";
import { STATE_FILTER_OPTIONS } from "@/lib/taxonomy-labels";
import type { Actor } from "@/server/authz/scope";
import { listPrograms, parseProgramListParams } from "@/server/services/admin/taxonomy-editor";
import { StateMark } from "./taxonomy-nav";

/** Programs table for the admin editor (all states, filterable) and the manager's read-only view. */
export async function ProgramsList({ actor, searchParams, base, editor }: { actor: Actor; searchParams: Promise<SearchParams>; base: string; editor: boolean }) {
  const params = await searchParams;
  const list = parseProgramListParams(params);
  const programs = await listPrograms(actor, list, editor);
  const filtered = Boolean(list.q || list.status);
  const sortProps = { current: list.sort, dir: list.dir, path: base, params, className: SORT_TH };

  return (
    <Panel>
      <PanelHeader title="البرامج" description={`عدد النتائج: ${formatNumber(programs.length)}`} />
      <ListToolbar
        action={base}
        q={list.q}
        searchLabel="اسم البرنامج"
        keep={{ sort: params.sort as string | undefined, dir: params.dir as string | undefined }}
        hasActive={filtered}
        filters={editor ? [{ name: "status", label: "الحالة", allLabel: "جميع الحالات", value: list.status, options: STATE_FILTER_OPTIONS.program }] : []}
      />
      {programs.length === 0 ? (
        <EmptyState
          variant="inline"
          title={filtered ? "لا توجد برامج مطابقة" : "لا توجد برامج بعد"}
          description={filtered ? "غيّر عبارة البحث أو التصفية." : "تُحمَّل البرامج من البيانات الأساسية، ويمكن لمدير النظام إضافة برنامج جديد."}
        />
      ) : (
        // Seven programs today; the whole list fits on one page, so no pagination row is needed.
        <DataTable caption="البرامج" minWidth="44rem">
          <THead>
            <SortHeader label="الرقم" column="number" {...sortProps} className={cn(SORT_TH, "w-20")} />
            <SortHeader label="البرنامج" column="name" {...sortProps} />
            <Th className="w-28">المبادرات</Th>
            <Th className="w-28">الأهداف</Th>
            {editor ? <Th className="w-32">الحالة</Th> : null}
          </THead>
          <tbody>
            {programs.map((p) => (
              <Tr key={p.id} className={p.state === "archived" ? "text-ink-subtle" : undefined}>
                <Td className="t-figure font-semibold text-accent-ink">{toArabicDigits(p.number)}</Td>
                <Td>
                  <Link href={`${base}/programs/${p.number}`} className="font-semibold text-ink hover:text-primary hover:underline">
                    {p.name}
                  </Link>
                  {p.officialName ? <span className="t-caption mt-0.5 block">{p.officialName}</span> : null}
                </Td>
                <Td className="t-figure">{formatNumber(p.initiativeCount)}</Td>
                <Td className="t-figure">{formatNumber(p.goalCount)}</Td>
                {editor ? (
                  <Td>
                    <StateMark state={p.state} kind="program" />
                  </Td>
                ) : null}
              </Tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Panel>
  );
}
