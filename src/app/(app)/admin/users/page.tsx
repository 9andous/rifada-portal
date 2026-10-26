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
import { DateDisplay } from "@/components/ui/date-display";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { Pagination } from "@/components/ui/pagination";
import { SortHeader } from "@/components/ui/sort-header";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { DataTable, SORT_TH, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatNumber, toArabicDigits } from "@/lib/format";
import type { SearchParams } from "@/lib/list-params";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { ROLE_LABELS, ROLES } from "@/server/authz/roles";
import { db } from "@/server/db";
import { listUsers, parseUserListParams, userFigures } from "@/server/services/admin/users";

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
          <UsersList user={user} searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}

async function UsersList({ user, searchParams }: { user: CurrentUser; searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const list = parseUserListParams(params);
  const [page, programs] = await Promise.all([
    listUsers(user, list),
    db.program.findMany({ where: { archivedAt: null }, orderBy: { number: "asc" }, select: { id: true, number: true, name: true } }),
  ]);
  const filtered = Boolean(list.q || list.role || list.status || list.program);
  const sortProps = { current: list.sort, dir: list.dir, path: PATH, params, className: SORT_TH };

  return (
    <Panel>
      <PanelHeader title="قائمة المستخدمين" description={`عدد النتائج: ${formatNumber(page.total)}`} />
      <ListToolbar
        action={PATH}
        q={list.q}
        searchLabel="الاسم أو اسم المستخدم أو البريد أو الهاتف"
        keep={{ sort: params.sort as string | undefined, dir: params.dir as string | undefined }}
        hasActive={filtered}
        filters={[
          { name: "role", label: "الدور", allLabel: "جميع الأدوار", value: list.role, options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
          {
            name: "status",
            label: "الحالة",
            allLabel: "جميع الحالات",
            value: list.status,
            options: [
              { value: "active", label: "نشط" },
              { value: "inactive", label: "معطل" },
            ],
          },
          {
            name: "program",
            label: "برنامج المشرف",
            allLabel: "جميع البرامج",
            value: list.program,
            options: programs.map((p) => ({ value: p.id, label: `${toArabicDigits(p.number)}. ${p.name}` })),
          },
        ]}
      />
      {page.items.length === 0 ? (
        filtered ? (
          <EmptyState variant="inline" title="لا توجد حسابات مطابقة" description="غيّر عبارة البحث أو التصفية، أو امسح التصفية لعرض جميع الحسابات." />
        ) : (
          <EmptyState
            variant="inline"
            title="لا توجد حسابات بعد"
            description="أنشئ حسابات المشرفين ومدير الوحدة ومسؤولي الجمعيات من زر «مستخدم جديد»."
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
              <SortHeader label="الدور" column="role" {...sortProps} />
              <Th>الحالة</Th>
              <SortHeader label="آخر دخول" column="lastLoginAt" {...sortProps} />
              <SortHeader label="تاريخ الإنشاء" column="createdAt" {...sortProps} />
            </THead>
            <tbody>
              {page.items.map((u) => (
                <Tr key={u.id}>
                  <Td>
                    <Link href={`/admin/users/${u.id}`} className="font-semibold text-ink hover:text-primary hover:underline">
                      {u.name}
                    </Link>
                    <span className="t-caption mt-0.5 block">
                      <bdi dir="ltr">{u.username}</bdi>
                    </span>
                  </Td>
                  <Td>
                    {ROLE_LABELS[u.role]}
                    {u.associationName ? <span className="t-caption mt-0.5 block">{u.associationName}</span> : null}
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
