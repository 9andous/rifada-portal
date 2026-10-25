import Link from "next/link";
import { EmptyState } from "@/components/states/states";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { Pagination } from "@/components/ui/pagination";
import { SortHeader } from "@/components/ui/sort-header";
import { DataTable, SORT_TH, THead, Td, Th, Tr } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { listHref, type SearchParams } from "@/lib/list-params";
import { STATE_FILTER_OPTIONS } from "@/lib/taxonomy-labels";
import type { Actor } from "@/server/authz/scope";
import { getProgramMatrix, listInitiatives, parseInitiativeListParams } from "@/server/services/admin/taxonomy-editor";
import { ObjectiveCells, ObjectiveHeaderCells, ObjectiveLegend } from "./objective-grid";
import { StateMark } from "./taxonomy-nav";

/** The program's initiatives: search, state filter (editor), sort and pagination. */
export async function InitiativesSection({
  actor,
  programId,
  params,
  path,
  initiativeBase,
  editor,
}: {
  actor: Actor;
  programId: string;
  params: SearchParams;
  /** The program page URL; the tab is kept in the URL. */
  path: string;
  initiativeBase: string;
  editor: boolean;
}) {
  const list = parseInitiativeListParams(params);
  const page = await listInitiatives(actor, programId, list, editor);
  const filtered = Boolean(list.q || list.status);
  const sortProps = { current: list.sort, dir: list.dir, path, params, className: SORT_TH };

  return (
    <>
      <ListToolbar
        action={path}
        q={list.q}
        searchLabel="اسم المبادرة أو رقمها"
        keep={{ tab: "initiatives", sort: params.sort as string | undefined, dir: params.dir as string | undefined }}
        hasActive={filtered}
        filters={editor ? [{ name: "status", label: "الحالة", allLabel: "جميع الحالات", value: list.status, options: STATE_FILTER_OPTIONS.initiative }] : []}
      />
      {page.items.length === 0 ? (
        <EmptyState
          variant="inline"
          title={filtered ? "لا توجد مبادرات مطابقة" : "لا توجد مبادرات في هذا البرنامج"}
          description={filtered ? "غيّر عبارة البحث أو التصفية؛ المؤرشفة تظهر عند اختيار حالة «مؤرشفة»." : undefined}
        />
      ) : (
        <>
          <DataTable caption="مبادرات البرنامج" minWidth="44rem">
            <THead>
              <SortHeader label="الرقم" column="number" {...sortProps} className={cn(SORT_TH, "w-20")} />
              <SortHeader label="المبادرة" column="name" {...sortProps} />
              <Th className="w-28">الأهداف</Th>
              <Th className="w-28">المتطلبات</Th>
              <Th className="w-28">الحالة</Th>
            </THead>
            <tbody>
              {page.items.map((i) => (
                <Tr key={i.id} className={i.state === "archived" ? "text-ink-subtle" : undefined}>
                  <Td className="t-figure font-semibold text-ink-subtle">{toArabicDigits(i.number)}</Td>
                  <Td>
                    <Link href={`${initiativeBase}/${i.id}`} className={cn("hover:text-primary hover:underline", i.state === "archived" ? "text-ink-subtle" : "text-ink")}>
                      {i.name}
                    </Link>
                  </Td>
                  <Td className="t-figure">{formatNumber(i.linkCount)}</Td>
                  <Td className="t-figure">{formatNumber(i.requirementCount)}</Td>
                  <Td>
                    <StateMark state={i.state} kind="initiative" />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={page.page} pageCount={page.pageCount} pageSize={page.pageSize} total={page.total} path={path} params={{ ...params, tab: "initiatives" }} />
        </>
      )}
    </>
  );
}

/** Initiatives × the 7 objectives, read-only; each row opens the initiative's link editor. */
export async function MatrixSection({
  actor,
  programId,
  params,
  path,
  initiativeBase,
  editor,
}: {
  actor: Actor;
  programId: string;
  params: SearchParams;
  path: string;
  initiativeBase: string;
  editor: boolean;
}) {
  const includeArchived = editor && params.archived === "1";
  const matrix = await getProgramMatrix(actor, programId, { editor, includeArchived });
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4">
        <p className="t-caption">علامة الصح في الخانة تعني ارتباط المبادرة بالهدف. لتعديل الارتباط افتح المبادرة.</p>
        {editor ? (
          <Link href={listHref(path, { tab: "matrix" }, { archived: includeArchived ? undefined : "1" })} scroll={false} className="text-sm text-primary hover:underline">
            {includeArchived ? "إخفاء المبادرات المؤرشفة" : "إظهار المبادرات المؤرشفة"}
          </Link>
        ) : null}
      </div>
      {matrix.initiatives.length === 0 ? (
        <EmptyState variant="inline" title="لا توجد مبادرات لعرضها" />
      ) : (
        <div className="overflow-x-auto pb-4">
          <table className="t-table w-full min-w-[44rem] border-collapse">
            <caption className="sr-only">ارتباط المبادرات بالأهداف الإستراتيجية</caption>
            <thead className="bg-surface-muted">
              <tr>
                <th scope="col" className="t-label w-14 py-2.5 ps-6 text-start">
                  الرقم
                </th>
                <th scope="col" className="t-label py-2.5 text-start">
                  المبادرة
                </th>
                <ObjectiveHeaderCells objectives={matrix.objectives} />
                <th aria-hidden="true" className="w-4" />
              </tr>
            </thead>
            <tbody>
              {matrix.initiatives.map((i) => (
                <tr key={i.id} className={cn("border-b border-line last:border-0", i.state === "archived" && "text-ink-subtle")}>
                  <td className="py-2.5 ps-6 font-semibold text-ink-subtle">{toArabicDigits(i.number)}</td>
                  <td className="py-2.5 pe-4">
                    <Link href={`${initiativeBase}/${i.id}?tab=links`} className="hover:text-primary hover:underline">
                      {i.name}
                    </Link>
                    {i.state !== "active" ? (
                      <span className="ms-2 align-middle">
                        <StateMark state={i.state} kind="initiative" />
                      </span>
                    ) : null}
                  </td>
                  <ObjectiveCells linked={i.objectives} />
                  <td aria-hidden="true" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-line px-6 py-5">
        <ObjectiveLegend objectives={matrix.objectives} />
      </div>
    </>
  );
}
