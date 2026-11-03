import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { CircleCheck, FilePen, FilePlus2, FileText, Hourglass, RefreshCw, RotateCcw, Send, XCircle } from "lucide-react";
import { KpiRow, type Kpi } from "@/components/dashboard/kpis";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { Pagination } from "@/components/ui/pagination";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { Th } from "@/components/ui/table";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { listHref, type SearchParams } from "@/lib/list-params";
import type { CurrentUser } from "@/server/auth/session";
import { listRequests, parseRequestListParams, requestFilterOptions, requestStatusCounts, type RequestListView } from "@/server/services/requests/read";
import { RequestsTable } from "./requests-table";

/** Big status numbers under the page head that act as filters (change 16). */
async function StatusFigures({ user, view, path, searchParams }: { user: CurrentUser; view: RequestListView; path: string; searchParams: Promise<SearchParams> }) {
  const [params, counts] = await Promise.all([searchParams, requestStatusCounts(user, view)]);
  const active = typeof params.status === "string" ? params.status : undefined;
  const total = counts.reduce((n, s) => n + s.count, 0);
  // «مقدَّم» and «فحص الاكتمال» last only for the instant of submission; shown only when not empty.
  const shown = counts.filter((s) => s.count > 0 || s.key !== "SUBMITTED" || s.key === active);
  const items = [{ key: undefined as string | undefined, name: "الكل", count: total }, ...shown.map((s) => ({ key: s.key as string | undefined, name: s.name, count: s.count }))];
  // Every role: the first figure is green until another is chosen, then the chosen one is (D-130).
  return <StaffStatusFigures items={items} active={active} path={path} params={params} role={user.role} />;
}

const STATUS_ICONS = {
  APPROVED: CircleCheck,
  RETURNED: RotateCcw,
  UNDER_REVIEW: Hourglass,
  REJECTED: XCircle,
  SUBMITTED: Send,
  RESUBMITTED: RefreshCw,
  DRAFT: FilePen,
} as const;

const OFFICER_CAPTIONS: Record<string, string> = {
  DRAFT: "لم تُرسل بعد",
  UNDER_REVIEW: "لدى الوحدة الإشرافية",
  RETURNED: "بانتظار تعديلكم",
  APPROVED: "طلبات معتمدة",
  REJECTED: "طلبات غير معتمدة",
};

function StaffStatusFigures({
  items,
  active,
  path,
  params,
  role,
}: {
  items: { key: string | undefined; name: string; count: number }[];
  active: string | undefined;
  path: string;
  params: SearchParams;
  role: CurrentUser["role"];
}) {
  const officer = role === "ASSOCIATION_OFFICER";
  const kpis: Kpi[] = items.map((item, index) => {
    const Icon = (item.key && STATUS_ICONS[item.key as keyof typeof STATUS_ICONS]) || (index === 0 ? FileText : Send);
    const selected = item.key === active || (!active && index === 0);
    const caption =
      index === 0
        ? officer
          ? "جميع طلبات الجمعية"
          : role === "SUPERVISOR"
            ? "في البرامج المسندة إليك"
            : "في جميع البرامج"
        : officer
          ? OFFICER_CAPTIONS[item.key ?? ""] ?? "طلبات الجمعية"
          : item.key === "RESUBMITTED"
            ? "أعادتها الجمعية بعد التعديل"
            : item.key === "UNDER_REVIEW"
          ? role === "SUPERVISOR"
            ? "بانتظار قرارك"
            : "بانتظار قرار المشرف أو اعتمادك"
          : item.key === "RETURNED"
            ? "تحتاج متابعة"
            : item.key === "APPROVED"
              ? "طلبات صدر اعتمادها"
              : item.key === "REJECTED"
                ? "طلبات غير معتمدة"
                : "طلبات واردة";
    return {
      label: index === 0 ? (role === "SUPERVISOR" ? "الطلبات المسندة" : officer ? "جميع الطلبات" : "إجمالي الطلبات") : item.name,
      icon: Icon,
      featured: selected,
      value: formatNumber(item.count),
      caption,
      href: listHref(path, params, { status: item.key, page: undefined }),
    };
  });
  return <KpiRow items={kpis} />;
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
  const staff = user.role !== "ASSOCIATION_OFFICER";
  const [page, options] = await Promise.all([
    listRequests(user, list, view),
    staff ? requestFilterOptions(user) : Promise.resolve({ tracks: [], supervisors: [] }),
  ]);
  const filtered = Boolean(list.q || list.status || list.track || list.program || list.supervisor || list.association || list.overdue || list.stage);
  const showSupervisor = staff && view !== "queue";

  const filters = [];
  if (staff && options.tracks.length > 1) {
    filters.push({ name: "track", label: "المسار", allLabel: "جميع المسارات", value: list.track, options: options.tracks.map((t) => ({ value: t.id, label: `${toArabicDigits(t.number)}. ${t.name}` })) });
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

  if (staff) {
    filters.push({ name: "overdue", label: "المهلة", allLabel: "جميع المهل", value: list.overdue ? "1" : undefined, options: [{ value: "1", label: "المتأخرة عن المهلة" }] });
    // The two-step review (D-116): who has the request under review now.
    filters.push({
      name: "stage",
      label: "مرحلة المراجعة",
      allLabel: "جميع المراحل",
      value: list.stage,
      options: [
        { value: "supervisor", label: "لدى المشرف" },
        { value: "manager", label: "بانتظار مدير الوحدة" },
      ],
    });
  }

  return (
    <Panel>
      <PanelHeader title="قائمة الطلبات" description={`عدد النتائج: ${formatNumber(page.total)}`} />
      <ListToolbar
        action={path}
        q={list.q}
        searchLabel={staff ? "رقم الطلب أو العنوان أو اسم الجمعية" : "رقم الطلب أو العنوان"}
        keep={{ status: list.status, association: list.association }}
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
            headers={
              <>
                <Th>الطلب</Th>
                <Th>المسار</Th>
                <Th>الحالة</Th>
                {showSupervisor ? <Th>المشرف</Th> : null}
                <Th>تاريخ التقديم</Th>
                <Th>المهلة</Th>
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
