import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { FilePlus2 } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { FIGURE_TILE, FIGURE_VALUE, FigureChevron, PageBand } from "@/components/layout/page-band";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { Pagination } from "@/components/ui/pagination";
import { SortHeader } from "@/components/ui/sort-header";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { SORT_TH, Th } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { listHref, type SearchParams } from "@/lib/list-params";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { supervisorOptions } from "@/server/services/requests/assignment";
import { listRequests, parseRequestListParams, requestFilterOptions, requestStatusCounts, type RequestListView } from "@/server/services/requests/read";
import { getSetting } from "@/server/settings/read";
import { RequestsTable } from "./requests-table";

/** Big status numbers under the page head that act as filters (change 16). */
async function StatusFigures({ user, view, path, searchParams }: { user: CurrentUser; view: RequestListView; path: string; searchParams: Promise<SearchParams> }) {
  const [params, counts] = await Promise.all([searchParams, requestStatusCounts(user, view)]);
  const active = typeof params.status === "string" ? params.status : undefined;
  const total = counts.reduce((n, s) => n + s.count, 0);
  // «مقدَّم» and «فحص الاكتمال» last only for the instant of submission; shown only when not empty.
  const shown = counts.filter((s) => s.count > 0 || !["SUBMITTED", "COMPLETENESS_CHECK"].includes(s.key) || s.key === active);
  const items = [{ key: undefined as string | undefined, name: "الكل", count: total }, ...shown.map((s) => ({ key: s.key as string | undefined, name: s.name, count: s.count }))];
  return (
    <nav aria-label="تصفية حسب الحالة">
      <ul className="flex flex-wrap gap-3.5">
        {items.map((s) => {
          const selected = s.key === active;
          return (
            <li key={s.name} className="min-w-36">
              <Link
                href={listHref(path, params, { status: s.key, page: undefined })}
                aria-current={selected ? "true" : undefined}
                scroll={false}
                className={cn(FIGURE_TILE, "card-link h-full", selected && "border-primary dark:border-accent")}
              >
                {selected ? <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-accent" /> : null}
                <span className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-[0.875rem] font-medium text-ink-muted">{s.name}</span>
                  <FigureChevron />
                </span>
                <span className={cn(FIGURE_VALUE, "text-ink")}>{formatNumber(s.count)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function FiguresSkeleton() {
  return (
    <div className="flex flex-wrap gap-3.5" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="block h-[86px] w-36 animate-pulse rounded-xl bg-surface-sunken" />
      ))}
    </div>
  );
}

export type RequestListPageProps = {
  user: CurrentUser;
  view: RequestListView;
  path: string;
  detailBase: string;
  title: string;
  eyebrow?: string;
  lead: string;
  actions?: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
  /** Optional notice above the list (e.g. after deleting a draft). */
  notice?: ReactNode;
  searchParams: Promise<SearchParams>;
};

/** A requests list for any role (docs/DESIGN.md: Requests list). Data and actions come from the server per role. */
export function RequestListPage(props: RequestListPageProps) {
  const { user, view, path, title, eyebrow, lead, actions, searchParams } = props;
  return (
    <>
      <PageBand
        compact
        eyebrow={eyebrow}
        title={title}
        lead={lead}
        actions={actions}
        figures={
          <Suspense fallback={<FiguresSkeleton />}>
            <StatusFigures user={user} view={view} path={path} searchParams={searchParams} />
          </Suspense>
        }
      />
      <PageBody>
        {props.notice ? (
          <div className="mb-4">
            <Suspense fallback={null}>{props.notice}</Suspense>
          </div>
        ) : null}
        <Suspense fallback={<ListSkeleton />}>
          <RequestList {...props} />
        </Suspense>
      </PageBody>
    </>
  );
}

async function RequestList({ user, view, path, detailBase, emptyTitle, emptyDescription, emptyAction, searchParams }: RequestListPageProps) {
  const params = await searchParams;
  const list = parseRequestListParams(params, view);
  const isManager = can(user.role, "requests.assign");
  const staff = user.role !== "ASSOCIATION_OFFICER";
  const [page, options, maxBulk, supervisors] = await Promise.all([
    listRequests(user, list, view),
    staff ? requestFilterOptions(user) : Promise.resolve({ programs: [], supervisors: [] }),
    getSetting("bulk.maxItems"),
    isManager ? supervisorOptions(user) : Promise.resolve(null),
  ]);
  const filtered = Boolean(list.q || list.status || list.program || list.supervisor || list.association);
  const sortProps = { current: list.sort, dir: list.dir, path, params, className: SORT_TH };
  const showSupervisor = staff && view !== "queue";
  const canDecide = can(user.role, "requests.review");

  const filters = [];
  if (staff && options.programs.length > 1) {
    filters.push({ name: "program", label: "البرنامج", allLabel: "جميع البرامج", value: list.program, options: options.programs.map((p) => ({ value: p.id, label: `${toArabicDigits(p.number)}. ${p.name}` })) });
  }
  if (options.supervisors.length && view !== "queue") {
    filters.push({
      name: "supervisor",
      label: "المشرف",
      allLabel: "جميع المشرفين",
      value: list.supervisor,
      options: [{ value: "none", label: "غير مسند" }, ...options.supervisors.map((s) => ({ value: s.id, label: s.isActive ? s.name : `${s.name} (معطل)` }))],
    });
  }

  return (
    <Panel>
      <PanelHeader title="قائمة الطلبات" description={`عدد النتائج: ${formatNumber(page.total)}`} />
      <ListToolbar
        action={path}
        q={list.q}
        searchLabel={staff ? "رقم الطلب أو العنوان أو اسم الجمعية" : "رقم الطلب أو العنوان"}
        keep={{ status: list.status, association: list.association, sort: params.sort as string | undefined, dir: params.dir as string | undefined }}
        hasActive={filtered}
        filters={filters}
      />
      {page.items.length === 0 ? (
        filtered ? (
          <EmptyState variant="inline" title="لا توجد طلبات مطابقة" description="غيّر عبارة البحث أو التصفية، أو امسح التصفية لعرض جميع الطلبات." />
        ) : (
          <EmptyState variant="inline" icon={<FilePlus2 strokeWidth={1.75} />} title={emptyTitle} description={emptyDescription} action={emptyAction} />
        )
      ) : (
        <>
          <RequestsTable
            rows={page.items}
            detailBase={detailBase}
            showAssociation={staff}
            showSupervisor={showSupervisor}
            bulk={{ enabled: canDecide, max: maxBulk, supervisors: supervisors?.map((s) => ({ id: s.id, name: s.name, programIds: s.programIds })) ?? null }}
            headers={
              <>
                <SortHeader label="الطلب" column="title" {...sortProps} />
                <Th>البرنامج والمبادرة</Th>
                <Th>الحالة</Th>
                {showSupervisor ? <Th>المشرف</Th> : null}
                <SortHeader label="تاريخ التقديم" column="submittedAt" {...sortProps} />
                <SortHeader label="المهلة" column="slaDueAt" {...sortProps} />
                <Th>
                  <span className="sr-only">إجراءات</span>
                </Th>
              </>
            }
          />
          <Pagination page={page.page} pageCount={page.pageCount} pageSize={page.pageSize} total={page.total} path={path} params={params} />
        </>
      )}
    </Panel>
  );
}

/** «طلب جديد» as a band action for the officer. */
export function NewRequestLink({ variant = "onBand" }: { variant?: "onBand" | "primary" }) {
  return (
    <Link href="/association/requests/new" className={buttonClasses(variant)}>
      <FilePlus2 strokeWidth={1.75} aria-hidden="true" />
      طلب جديد
    </Link>
  );
}
