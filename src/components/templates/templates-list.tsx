import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { Pagination } from "@/components/ui/pagination";
import { SortHeader } from "@/components/ui/sort-header";
import { Panel, PanelHeader, StatusText, type StatusTone } from "@/components/ui/surface";
import { DataTable, SORT_TH, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatFileSize, formatNumber, toArabicDigits } from "@/lib/format";
import type { SearchParams } from "@/lib/list-params";
import { FILE_TYPES, type AllowedExtension } from "@/lib/uploads";
import { can } from "@/server/authz/permissions";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { listTemplates, parseTemplateListParams, type TemplateState } from "@/server/services/admin/templates";

export const TEMPLATE_STATE_LABEL: Record<TemplateState, { label: string; tone: StatusTone }> = {
  published: { label: "منشور", tone: "ok" },
  unpublished: { label: "غير منشور", tone: "warn" },
  archived: { label: "مؤرشف", tone: "neutral" },
};

export function fileKind(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() as AllowedExtension | undefined;
  return ext && ext in FILE_TYPES ? FILE_TYPES[ext].label : "ملف";
}

export function downloadHref(id: string, version?: number) {
  return `/api/templates/${id}/download${version ? `?version=${version}` : ""}`;
}

/**
 * Templates table. `admin`: every state, rows open the template page. `reader`: published only
 * (officers, supervisors, the unit manager), with a download button per row.
 */
export async function TemplatesList({ actor, searchParams, path, view }: { actor: Actor; searchParams: Promise<SearchParams>; path: string; view: "admin" | "reader" }) {
  const params = await searchParams;
  const list = parseTemplateListParams(params);
  const [page, programs] = await Promise.all([
    listTemplates(actor, list, view),
    db.program.findMany({ where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { number: "asc" }], select: { id: true, number: true, name: true } }),
  ]);
  const filtered = Boolean(list.q || list.state || list.program);
  const sortProps = { current: list.sort, dir: list.dir, path, params, className: SORT_TH };

  return (
    <Panel>
      <PanelHeader title="النماذج" description={`عدد النتائج: ${formatNumber(page.total)}`} />
      <ListToolbar
        action={path}
        q={list.q}
        searchLabel="عنوان النموذج أو وصفه أو اسم الملف"
        keep={{ sort: params.sort as string | undefined, dir: params.dir as string | undefined }}
        hasActive={filtered}
        filters={[
          { name: "program", label: "البرنامج", allLabel: "جميع البرامج", value: list.program, options: programs.map((p) => ({ value: p.id, label: `${toArabicDigits(p.number)}. ${p.name}` })) },
          ...(view === "admin"
            ? [
                {
                  name: "state",
                  label: "الحالة",
                  allLabel: "جميع الحالات",
                  value: list.state,
                  options: (["published", "unpublished", "archived"] as const).map((s) => ({ value: s, label: TEMPLATE_STATE_LABEL[s].label })),
                },
              ]
            : []),
        ]}
      />
      {page.items.length === 0 ? (
        <EmptyState
          variant="inline"
          title={filtered ? "لا توجد نماذج مطابقة" : view === "admin" ? "لا توجد نماذج بعد" : "لا توجد نماذج منشورة بعد"}
          description={filtered ? "غيّر البحث أو التصفية." : view === "admin" ? "أضف أول نموذج ثم انشره ليظهر للجمعيات والفريق." : "تظهر هنا النماذج التي تنشرها الوحدة الإشرافية للتنزيل."}
          action={
            !filtered && view === "admin" && can(actor.role, "content.manage") ? (
              <Link href="/admin/taxonomy/templates/new" className={buttonClasses("primary")}>
                <Plus aria-hidden="true" strokeWidth={1.75} />
                نموذج جديد
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <DataTable caption="النماذج" minWidth="52rem">
            <THead>
              <SortHeader label="النموذج" column="title" {...sortProps} />
              <Th>البرنامج والمبادرة</Th>
              <Th className="w-40">الملف</Th>
              {view === "admin" ? <Th className="w-28">الحالة</Th> : null}
              <SortHeader label="آخر تحديث" column="updatedAt" {...sortProps} />
              <Th className="w-28">
                <span className="sr-only">تنزيل</span>
              </Th>
            </THead>
            <tbody>
              {page.items.map((t) => (
                <Tr key={t.id} className={t.state === "archived" ? "text-ink-subtle" : undefined}>
                  <Td>
                    {view === "admin" ? (
                      <Link href={`${path}/${t.id}`} className="font-semibold text-ink hover:text-primary hover:underline">
                        {t.title}
                      </Link>
                    ) : (
                      <span className="font-semibold text-ink">{t.title}</span>
                    )}
                    {t.description ? <span className="t-caption mt-0.5 line-clamp-2 block">{t.description}</span> : null}
                    {t.attachmentType ? <span className="t-caption mt-0.5 block">لمرفق: {t.attachmentType.name}</span> : null}
                  </Td>
                  <Td className="text-sm">
                    {t.program ? `${toArabicDigits(t.program.number)}. ${t.program.name}` : <span className="text-ink-subtle">عام لجميع البرامج</span>}
                    {t.initiative ? <span className="t-caption mt-0.5 block">المبادرة {toArabicDigits(t.initiative.number)}: {t.initiative.name}</span> : null}
                  </Td>
                  <Td className="text-sm">
                    {fileKind(t.fileName)} · {formatFileSize(t.size)}
                    {view === "admin" && t.versions > 1 ? <span className="t-caption mt-0.5 block">الإصدارات: {formatNumber(t.versions)}</span> : null}
                  </Td>
                  {view === "admin" ? (
                    <Td>
                      <StatusText tone={TEMPLATE_STATE_LABEL[t.state].tone}>{TEMPLATE_STATE_LABEL[t.state].label}</StatusText>
                    </Td>
                  ) : null}
                  <Td>
                    <DateDisplay date={t.updatedAt} />
                  </Td>
                  <Td>
                    {/* A plain link: the route handler sends the file as an attachment. */}
                    <a href={downloadHref(t.id)} className={buttonClasses("outline", "sm")} aria-label={`تنزيل «${t.title}»`}>
                      <Download aria-hidden="true" strokeWidth={1.75} />
                      تنزيل
                    </a>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={page.page} pageCount={page.pageCount} pageSize={page.pageSize} total={page.total} path={path} params={params} />
        </>
      )}
    </Panel>
  );
}
