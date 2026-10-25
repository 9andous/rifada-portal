import Link from "next/link";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { Pagination } from "@/components/ui/pagination";
import { SortHeader } from "@/components/ui/sort-header";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { DataTable, SORT_TH, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatNumber, toArabicDigits } from "@/lib/format";
import type { SearchParams } from "@/lib/list-params";
import type { Actor } from "@/server/authz/scope";
import { associationRegions, listAssociations, parseAssociationListParams } from "@/server/services/admin/associations";

/**
 * The association registry table, shared by the super admin (editable) and the unit manager
 * (read-only). The loader enforces who may read it.
 */
export async function AssociationsList({
  actor,
  searchParams,
  basePath,
  readOnly,
}: {
  actor: Actor;
  searchParams: Promise<SearchParams>;
  basePath: string;
  readOnly: boolean;
}) {
  const params = await searchParams;
  const list = parseAssociationListParams(params);
  const [page, regions] = await Promise.all([listAssociations(actor, list), associationRegions(actor)]);
  const filtered = Boolean(list.q || list.status || list.officer || list.region);
  const sortProps = { current: list.sort, dir: list.dir, path: basePath, params, className: SORT_TH };

  return (
    <Panel>
      <PanelHeader title="سجل الجمعيات" description={`عدد النتائج: ${formatNumber(page.total)}`} />
      <ListToolbar
        action={basePath}
        q={list.q}
        searchLabel="اسم الجمعية أو رقم الترخيص أو المدينة أو مسؤول التواصل"
        keep={{ sort: params.sort as string | undefined, dir: params.dir as string | undefined }}
        hasActive={filtered}
        filters={[
          {
            name: "status",
            label: "الحالة",
            allLabel: "جميع الحالات",
            value: list.status,
            options: [
              { value: "active", label: "نشطة" },
              { value: "inactive", label: "معطلة" },
            ],
          },
          {
            name: "officer",
            label: "حساب المسؤول",
            allLabel: "الكل",
            value: list.officer,
            options: [
              { value: "with", label: "لها حساب" },
              { value: "without", label: "بلا حساب" },
            ],
          },
          { name: "region", label: "المنطقة", allLabel: "جميع المناطق", value: list.region, options: regions.map((r) => ({ value: r, label: r })) },
        ]}
      />
      {page.items.length === 0 ? (
        filtered ? (
          <EmptyState variant="inline" title="لا توجد جمعيات مطابقة" description="غيّر عبارة البحث أو التصفية، أو امسح التصفية لعرض جميع الجمعيات." />
        ) : (
          <EmptyState
            variant="inline"
            title="لا توجد جمعيات مسجلة بعد"
            description={readOnly ? "تظهر هنا الجمعيات بعد أن يسجلها مدير النظام." : "سجّل الجمعيات المشرف عليها، ويمكنك إنشاء حساب مسؤول كل جمعية في الخطوة نفسها."}
            action={
              readOnly ? undefined : (
                <Link href="/admin/associations/new" className={buttonClasses("primary")}>
                  جمعية جديدة
                </Link>
              )
            }
          />
        )
      ) : (
        <>
          <DataTable caption="سجل الجمعيات" minWidth="56rem">
            <THead>
              <SortHeader label="الجمعية" column="name" {...sortProps} />
              <SortHeader label="المدينة" column="city" {...sortProps} />
              <SortHeader label="المنطقة" column="region" {...sortProps} />
              <Th>مسؤول التواصل</Th>
              <Th>حساب المسؤول</Th>
              <Th>الحالة</Th>
            </THead>
            <tbody>
              {page.items.map((a) => (
                <Tr key={a.id}>
                  <Td>
                    <Link href={`${basePath}/${a.id}`} className="font-semibold text-ink hover:text-primary hover:underline">
                      {a.name}
                    </Link>
                    <span className="t-caption mt-0.5 block">
                      {a.licenseNumber ? (
                        <>
                          الترخيص: <bdi dir="ltr">{toArabicDigits(a.licenseNumber)}</bdi>
                        </>
                      ) : (
                        "بلا رقم ترخيص"
                      )}
                    </span>
                  </Td>
                  <Td>{a.city ?? <span className="text-ink-subtle">—</span>}</Td>
                  <Td>{a.region ?? <span className="text-ink-subtle">—</span>}</Td>
                  <Td>{a.contactName ?? <span className="text-ink-subtle">—</span>}</Td>
                  <Td>
                    {a.officer ? (
                      <>
                        <bdi dir="ltr">{a.officer.username}</bdi>
                        {!a.officer.isActive ? <span className="t-caption mt-0.5 block">معطل</span> : null}
                      </>
                    ) : (
                      <span className="text-ink-subtle">لا يوجد</span>
                    )}
                  </Td>
                  <Td>
                    <StatusText tone={a.isActive ? "ok" : "neutral"}>{a.isActive ? "نشطة" : "معطلة"}</StatusText>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={page.page} pageCount={page.pageCount} pageSize={page.pageSize} total={page.total} path={basePath} params={params} />
        </>
      )}
    </Panel>
  );
}
