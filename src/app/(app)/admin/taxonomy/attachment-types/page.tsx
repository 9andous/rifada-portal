import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { EmptyState } from "@/components/states/states";
import { AttachmentTypeRowActions, NewAttachmentTypeButton } from "@/components/taxonomy/attachment-type-controls";
import { TaxonomyNav } from "@/components/taxonomy/taxonomy-nav";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { Pagination } from "@/components/ui/pagination";
import { SortHeader } from "@/components/ui/sort-header";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { DataTable, SORT_TH, THead, Td, Th, Tr } from "@/components/ui/table";
import { arabicList, formatNumber } from "@/lib/format";
import type { SearchParams } from "@/lib/list-params";
import { UPLOAD_GROUP_LABELS, type UploadGroup } from "@/lib/validation/settings";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { listAttachmentTypes, parseAttachmentTypeListParams } from "@/server/services/admin/attachment-types";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "أنواع المرفقات" };

const PATH = "/admin/taxonomy/attachment-types";

export default async function AttachmentTypesPage({ searchParams }: PageProps<"/admin/taxonomy/attachment-types">) {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.manage")) return <ForbiddenPage />;

  return (
    <>
      <PageBand
        compact
        title="أنواع المرفقات"
        lead="أنواع المستندات التي يمكن طلبها في متطلبات المبادرات، والملفات المقبولة لكل نوع. لا يُحذف نوع مستخدم؛ يُؤرشف."
        actions={<NewAttachmentTypeButton />}
      />
      <PageBody>
        <TaxonomyNav active="attachment-types" base="/admin/taxonomy" />
        <Suspense fallback={<ListSkeleton rows={5} />}>
          <TypesList user={user} searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}

async function TypesList({ user, searchParams }: { user: CurrentUser; searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const list = parseAttachmentTypeListParams(params);
  const [page, allowed] = await Promise.all([listAttachmentTypes(user, list), getSetting("uploads.allowedGroups")]);
  const allowedSet = new Set<string>(allowed);
  const filtered = Boolean(list.q || list.status);
  const sortProps = { current: list.sort, dir: list.dir, path: PATH, params, className: SORT_TH };

  return (
    <Panel>
      <PanelHeader title="الأنواع" description={`عدد النتائج: ${formatNumber(page.total)}`} />
      <ListToolbar
        action={PATH}
        q={list.q}
        searchLabel="الاسم أو المفتاح"
        keep={{ sort: params.sort as string | undefined, dir: params.dir as string | undefined }}
        hasActive={filtered}
        filters={[
          {
            name: "status",
            label: "الحالة",
            allLabel: "جميع الحالات",
            value: list.status,
            options: [
              { value: "active", label: "نشط" },
              { value: "archived", label: "مؤرشف" },
            ],
          },
        ]}
      />
      {page.items.length === 0 ? (
        <EmptyState variant="inline" title={filtered ? "لا توجد أنواع مطابقة" : "لا توجد أنواع مرفقات بعد"} description={filtered ? "غيّر البحث أو التصفية." : "أضف نوع مرفق جديدًا من الزر أعلى الصفحة."} />
      ) : (
        <>
          <DataTable caption="أنواع المرفقات" minWidth="48rem">
            <THead>
              <SortHeader label="الاسم" column="name" {...sortProps} />
              <SortHeader label="المفتاح" column="key" {...sortProps} />
              <Th>الملفات المقبولة</Th>
              <Th className="w-28">الاستخدام</Th>
              <Th className="w-24">الحالة</Th>
              <Th className="w-28">
                <span className="sr-only">إجراءات</span>
              </Th>
            </THead>
            <tbody>
              {page.items.map((t) => {
                const groups = t.allowedMimeGroups as UploadGroup[];
                const blocked = groups.filter((g) => !allowedSet.has(g));
                return (
                  <Tr key={t.id} className={t.archivedAt ? "text-ink-subtle" : undefined}>
                    <Td className="font-semibold">{t.name}</Td>
                    <Td>
                      <bdi dir="ltr" className="font-mono text-xs">
                        {t.key}
                      </bdi>
                    </Td>
                    <Td className="text-sm">
                      {arabicList(groups.map((g) => UPLOAD_GROUP_LABELS[g] ?? g))}
                      {blocked.length > 0 ? (
                        <span className="t-caption mt-0.5 block text-st-warn">غير مسموح حاليًا في الإعدادات: {arabicList(blocked.map((g) => UPLOAD_GROUP_LABELS[g] ?? g))}</span>
                      ) : null}
                    </Td>
                    <Td className="t-caption">{t.usage ? `في ${formatNumber(t.usage)} من المتطلبات` : "غير مستخدم"}</Td>
                    <Td>
                      <StatusText tone={t.archivedAt ? "neutral" : "ok"}>{t.archivedAt ? "مؤرشف" : "نشط"}</StatusText>
                    </Td>
                    <Td>
                      <AttachmentTypeRowActions id={t.id} typeKey={t.key} name={t.name} groups={groups} archived={Boolean(t.archivedAt)} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
          <Pagination page={page.page} pageCount={page.pageCount} pageSize={page.pageSize} total={page.total} path={PATH} params={params} />
        </>
      )}
    </Panel>
  );
}
