import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilePlus2, ListChecks, Search } from "lucide-react";
import { AssocRequestsTable, ListPager } from "@/components/association/parts";
import { PageBody } from "@/components/layout/app-shell";
import { FIGURE_TILE, FIGURE_VALUE, PageBand } from "@/components/layout/page-band";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Panel, PanelHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { firstParam, type SearchParams } from "@/lib/list-params";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { listRequests, parseRequestListParams, requestStatusCounts } from "@/server/services/requests/read";

export const metadata: Metadata = { title: "طلباتي" };

const PATH = "/association/requests";

/** «طلباتي» (D-102): the official statuses as filters, a search, and every request with its next step. */
export default async function MyRequestsPage({ searchParams }: PageProps<"/association/requests">) {
  const user = await requireUser();
  if (user.role !== "ASSOCIATION_OFFICER" || !can(user.role, "requests.read")) return <ForbiddenPage />;
  return (
    <>
      <PageBand
        title="طلباتي"
        lead="جميع طلبات جمعيتكم. اختاروا حالة لعرض طلباتها، أو ابحثوا باسم المشروع أو رقم الطلب."
        actions={
          <Link href={`${PATH}/new`} className={buttonClasses("gold", "lg")}>
            <FilePlus2 aria-hidden="true" strokeWidth={1.75} />
            تقديم طلب جديد
          </Link>
        }
        figures={
          <Suspense fallback={<span className="block h-[86px] animate-pulse rounded-xl bg-surface-sunken" />}>
            <StatusFilters user={user} searchParams={searchParams} />
          </Suspense>
        }
      />
      <PageBody>
        <Suspense fallback={<ListSkeleton />}>
          <MyRequests user={user} searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}

/** Build a list address from the current status and search. */
function listAddress(status: string | undefined, q: string | undefined, page?: number) {
  const search = new URLSearchParams();
  if (status) search.set("status", status);
  if (q) search.set("q", q);
  if (page && page > 1) search.set("page", String(page));
  const s = search.toString();
  return s ? `${PATH}?${s}` : PATH;
}

/** The statuses as tiles with their counts, always in the same places; the chosen one is marked. */
async function StatusFilters({ user, searchParams }: { user: CurrentUser; searchParams: Promise<SearchParams> }) {
  const [params, counts] = await Promise.all([searchParams, requestStatusCounts(user, "mine")]);
  const active = firstParam(params, "status");
  const q = firstParam(params, "q");
  const total = counts.reduce((n, s) => n + s.count, 0);
  // «مقدَّم» and «فحص الاكتمال» last only for the instant of submission; shown only when not empty.
  const shown = counts.filter((s) => s.count > 0 || !["SUBMITTED", "COMPLETENESS_CHECK"].includes(s.key) || s.key === active);
  const tiles = [{ key: undefined as string | undefined, name: "جميع الطلبات", count: total }, ...shown.map((s) => ({ key: s.key as string | undefined, name: s.name, count: s.count }))];
  return (
    <nav aria-label="عرض الطلبات حسب الحالة">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => {
          const selected = t.key === active;
          return (
            <li key={t.name}>
              <Link
                href={listAddress(t.key, q)}
                aria-current={selected ? "true" : undefined}
                scroll={false}
                className={cn(FIGURE_TILE, "card-link h-full", selected && "border-primary bg-primary-soft/40 dark:border-accent")}
              >
                {selected ? <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-accent" /> : null}
                <span className={cn("text-base", selected ? "font-bold text-ink" : "font-medium text-ink-muted")}>{t.name}</span>
                <span className={cn(FIGURE_VALUE, "text-ink")}>{formatNumber(t.count)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

async function MyRequests({ user, searchParams }: { user: CurrentUser; searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  // Newest activity first; the status tiles and the search are the only choices offered.
  const list = parseRequestListParams({ status: params.status, q: params.q, page: params.page, sort: "updatedAt", dir: "desc" }, "mine");
  const page = await listRequests(user, list, "mine");
  const q = list.q ?? "";
  const filtered = Boolean(list.status || q);

  return (
    <div className="flex flex-col gap-5">
      {firstParam(params, "discarded") === "1" ? <Alert tone="success">حُذفت المسودة وملفاتها.</Alert> : null}
      <Panel>
        <PanelHeader
          icon={<ListChecks strokeWidth={1.75} />}
          title="قائمة الطلبات"
          description={`عدد الطلبات: ${formatNumber(page.total)}`}
        />
        <form action={PATH} role="search" className="-mt-1 flex flex-wrap items-end gap-3 px-6 pb-5">
          {list.status ? <input type="hidden" name="status" value={list.status} /> : null}
          <label htmlFor="q" className="flex min-w-0 flex-1 basis-72 flex-col gap-1.5">
            <span className="text-[0.9375rem] font-semibold text-ink">البحث عن طلب</span>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="اسم المشروع أو رقم الطلب"
              className="h-11 w-full rounded-md border border-line-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-subtle focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
            />
          </label>
          <button type="submit" className={buttonClasses("gold")}>
            <Search aria-hidden="true" strokeWidth={1.75} />
            بحث
          </button>
          {filtered ? (
            <Link href={PATH} className={buttonClasses("ghost")}>
              عرض جميع الطلبات
            </Link>
          ) : null}
        </form>

        {page.items.length === 0 ? (
          filtered ? (
            <EmptyState variant="inline" title="لا توجد طلبات مطابقة" description="غيّروا الحالة المختارة أو كلمات البحث، أو اعرضوا جميع الطلبات." />
          ) : (
            <EmptyState
              variant="inline"
              icon={<FilePlus2 strokeWidth={1.75} />}
              title="لم تقدّموا أي طلب بعد"
              description="ابدؤوا بتقديم طلب لبرنامج أو مشروع ضمن برامج الرئاسة."
              action={
                <Link href={`${PATH}/new`} className={buttonClasses("gold", "lg")}>
                  <FilePlus2 aria-hidden="true" strokeWidth={1.75} />
                  تقديم طلب جديد
                </Link>
              }
            />
          )
        ) : (
          <AssocRequestsTable rows={page.items} caption="طلبات الجمعية" />
        )}
        <ListPager page={page.page} pageCount={page.pageCount} hrefFor={(n) => listAddress(list.status, q, n)} />
      </Panel>
    </div>
  );
}
