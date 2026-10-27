import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UserRoundPlus } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { DateDisplay } from "@/components/ui/date-display";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { Pagination } from "@/components/ui/pagination";
import { SortHeader } from "@/components/ui/sort-header";
import { TabNav } from "@/components/ui/tab-nav";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { DataTable, SORT_TH, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatNumber, toArabicDigits } from "@/lib/format";
import type { SearchParams } from "@/lib/list-params";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { ROLE_LABELS } from "@/server/authz/roles";
import { db } from "@/server/db";
import { listUsers, parseUserListParams, STAFF_ROLES, userFigures } from "@/server/services/admin/users";

export const metadata: Metadata = { title: "المستخدمون" };

const PATH = "/admin/users";

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const user = await requireUser();
  if (!can(user.role, "users.manage")) return <ForbiddenPage />;
  const figures = await userFigures(user);

  return (
    <>
      <PageBand
        compact
        title="المستخدمون"
        lead="حسابات فريق الوحدة ومسؤولي الجمعيات: الإنشاء والتعديل والتعطيل وإصدار كلمات مرور مؤقتة."
        actions={
          <Link href="/admin/users/new" className={buttonClasses("onBand")}>
            <UserRoundPlus strokeWidth={1.75} aria-hidden="true" />
            مستخدم جديد
          </Link>
        }
        figures={
          <BandFigures
            items={[
              { label: "الحسابات", value: formatNumber(figures.total), caption: "في جميع الأدوار" },
              { label: "النشطة", value: formatNumber(figures.active) },
              { label: "المعطلة", value: formatNumber(figures.inactive) },
              { label: "المشرفون النشطون", value: formatNumber(figures.byRole.SUPERVISOR) },
              { label: "مسؤولو الجمعيات النشطون", value: formatNumber(figures.byRole.ASSOCIATION_OFFICER) },
            ]}
          />
        }
      />
      <PageBody>
        <Suspense fallback={<ListSkeleton />}>
          <UsersList user={user} counts={{ staff: figures.staff, officers: figures.officers }} searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}

async function UsersList({
  user,
  counts,
  searchParams,
}: {
  user: CurrentUser;
  counts: { staff: number; officers: number };
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const list = parseUserListParams(params);
  const officers = list.tab === "officers";
  const [page, programs] = await Promise.all([
    listUsers(user, list),
    db.program.findMany({ where: { archivedAt: null }, orderBy: { number: "asc" }, select: { id: true, number: true, name: true } }),
  ]);
  const filtered = Boolean(list.q || (!officers && list.role) || list.status || (!officers && list.program));
  const sortProps = { current: list.sort, dir: list.dir, path: PATH, params, className: SORT_TH };
  const statusFilter = {
    name: "status",
    label: "الحالة",
    allLabel: "جميع الحالات",
    value: list.status,
    options: [
      { value: "active", label: "نشط" },
      { value: "inactive", label: "معطل" },
    ],
  };

  return (
    <Panel>
      <PanelHeader title="قائمة المستخدمين" description={`عدد النتائج: ${formatNumber(page.total)}`} className="mb-0!" />
      {/* Switching tabs starts a fresh list: filters belong to one kind of account. */}
      <TabNav
        label="نوع الحساب"
        active={list.tab}
        items={[
          { key: "staff", label: "فريق المنصة", href: PATH, count: formatNumber(counts.staff) },
          { key: "officers", label: "مسؤولو الجمعيات", href: `${PATH}?tab=officers`, count: formatNumber(counts.officers) },
        ]}
      />
      <ListToolbar
        action={PATH}
        q={list.q}
        searchLabel="الاسم أو اسم المستخدم أو البريد أو الهاتف"
        keep={{ tab: officers ? "officers" : undefined, sort: params.sort as string | undefined, dir: params.dir as string | undefined }}
        hasActive={filtered}
        filters={
          officers
            ? [statusFilter]
            : [
                { name: "role", label: "الدور", allLabel: "جميع الأدوار", value: list.role, options: STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
                statusFilter,
                {
                  name: "program",
                  label: "برنامج المشرف",
                  allLabel: "جميع البرامج",
                  value: list.program,
                  options: programs.map((p) => ({ value: p.id, label: `${toArabicDigits(p.number)}. ${p.name}` })),
                },
              ]
        }
      />
      {page.items.length === 0 ? (
        filtered ? (
          <EmptyState variant="inline" title="لا توجد حسابات مطابقة" description="غيّر عبارة البحث أو التصفية، أو امسح التصفية لعرض جميع الحسابات." />
        ) : (
          <EmptyState
            variant="inline"
            title={officers ? "لا توجد حسابات مسؤولي جمعيات بعد" : "لا توجد حسابات بعد"}
            description={
              officers
                ? "تُنشأ حسابات مسؤولي الجمعيات من زر «مستخدم جديد» أو من صفحة الجمعية، أو عند اعتماد طلب تسجيل جمعية."
                : "أنشئ حسابات المشرفين ومدير الوحدة من زر «مستخدم جديد»."
            }
            action={
              <Link href="/admin/users/new" className={buttonClasses("primary")}>
                مستخدم جديد
              </Link>
            }
          />
        )
      ) : (
        <>
          <DataTable caption="قائمة المستخدمين">
            <THead>
              <SortHeader label="الاسم" column="name" {...sortProps} />
              {officers ? <Th>الجمعية</Th> : <SortHeader label="الدور" column="role" {...sortProps} />}
              <Th>الحالة</Th>
              <SortHeader label="آخر دخول" column="lastLoginAt" {...sortProps} />
              <SortHeader label="تاريخ الإنشاء" column="createdAt" {...sortProps} />
            </THead>
            <tbody>
              {page.items.map((u) => (
                <Tr key={u.id}>
                  <Td>
                    <span className="flex items-center gap-3">
                      <Avatar name={u.name} src={u.imageUrl} />
                      <span className="min-w-0">
                        <Link href={`/admin/users/${u.id}`} className="font-semibold text-ink hover:text-primary hover:underline">
                          {u.name}
                        </Link>
                        <span className="t-caption mt-0.5 block">
                          <bdi dir="ltr">{u.username}</bdi>
                        </span>
                      </span>
                    </span>
                  </Td>
                  <Td>
                    {officers ? u.associationName ?? <span className="text-ink-subtle">—</span> : ROLE_LABELS[u.role]}
                    {u.role === "SUPERVISOR" ? (
                      <span className="t-caption mt-0.5 block">
                        {u.programNumbers.length > 0 ? `البرامج: ${u.programNumbers.map(toArabicDigits).join("، ")}` : "بلا برامج"}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <StatusText tone={u.isActive ? "ok" : "neutral"}>{u.isActive ? "نشط" : "معطل"}</StatusText>
                    {u.isActive && u.mustChangePassword ? <span className="t-caption mt-0.5 block">بانتظار تغيير كلمة المرور</span> : null}
                  </Td>
                  <Td>
                    {u.lastLoginAt ? <DateDisplay date={u.lastLoginAt} withTime /> : <span className="text-ink-subtle">لم يسجل الدخول</span>}
                  </Td>
                  <Td>
                    <DateDisplay date={u.createdAt} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={page.page} pageCount={page.pageCount} pageSize={page.pageSize} total={page.total} path={PATH} params={params} />
        </>
      )}
    </Panel>
  );
}
