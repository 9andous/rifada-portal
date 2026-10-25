import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuditChanges } from "@/components/admin/audit-changes";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { EmptyState } from "@/components/states/states";
import { DateDisplay } from "@/components/ui/date-display";
import { Input } from "@/components/ui/field";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { Pagination } from "@/components/ui/pagination";
import { SortHeader } from "@/components/ui/sort-header";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { DataTable, SORT_TH, THead, Td, Th, Tr } from "@/components/ui/table";
import { auditActionLabel, auditEntityLabel } from "@/lib/audit-labels";
import { formatHijri, formatNumber } from "@/lib/format";
import type { SearchParams } from "@/lib/list-params";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { auditFigures, auditFilterOptions, listAuditLog, parseAuditListParams, riyadhDayStart } from "@/server/services/admin/audit-log";

export const metadata: Metadata = { title: "سجل التدقيق" };

const PATH = "/admin/audit";

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const user = await requireUser();
  if (!can(user.role, "audit.read")) return <ForbiddenPage />;
  const { total, lastDay, actors } = await auditFigures(user);

  return (
    <>
      <PageBand
        compact
        title="سجل التدقيق"
        lead="كل عملية دخول وتعديل في المنصة بمنفّذها ووقتها والقيم قبلها وبعدها. السجل للاطلاع فقط ولا يمكن تعديله أو حذفه."
        figures={
          <BandFigures
            items={[
              { label: "العمليات المسجلة", value: formatNumber(total), emphasis: true },
              { label: "آخر ٢٤ ساعة", value: formatNumber(lastDay) },
              { label: "المنفّذون", value: formatNumber(actors), caption: "حسابات نفّذت عمليات" },
            ]}
          />
        }
      />
      <PageBody>
        <Suspense fallback={<ListSkeleton rows={12} />}>
          <AuditList user={user} searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}

function DateFilter({ name, label, value }: { name: string; label: string; value?: string }) {
  const start = riyadhDayStart(value);
  return (
    <div className="flex w-44 flex-col gap-1.5">
      <label htmlFor={`list-${name}`} className="t-label">
        {label}
      </label>
      <Input id={`list-${name}`} name={name} type="date" defaultValue={value} dir="ltr" />
      {start ? <span className="t-caption">{formatHijri(new Date(start.getTime() + 12 * 60 * 60 * 1000))}</span> : null}
    </div>
  );
}

async function AuditList({ user, searchParams }: { user: CurrentUser; searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const list = parseAuditListParams(params);
  const [page, options] = await Promise.all([listAuditLog(user, list), auditFilterOptions(user)]);
  const filtered = Boolean(list.actor || list.action || list.entity || list.from || list.to);

  return (
    <Panel>
      <PanelHeader title="العمليات" description={`عدد النتائج: ${formatNumber(page.total)}. التواريخ بتوقيت الرياض.`} />
      <ListToolbar
        action={PATH}
        keep={{ dir: params.dir as string | undefined }}
        hasActive={filtered}
        filters={[
          {
            name: "actor",
            label: "المنفّذ",
            allLabel: "جميع المنفّذين",
            value: list.actor,
            options: [
              { value: "system", label: "النظام (دون منفّذ)" },
              ...options.actors.map((a) => ({ value: a.id, label: a.username ? `${a.name} (${a.username})` : a.name })),
            ],
          },
          {
            name: "action",
            label: "العملية",
            allLabel: "جميع العمليات",
            value: list.action,
            options: options.actions.map((a) => ({ value: a, label: auditActionLabel(a) })),
          },
          {
            name: "entity",
            label: "نوع السجل",
            allLabel: "جميع الأنواع",
            value: list.entity,
            options: options.entities.map((e) => ({ value: e, label: auditEntityLabel(e) })),
          },
        ]}
        extra={
          <>
            <DateFilter name="from" label="من تاريخ" value={list.from} />
            <DateFilter name="to" label="إلى تاريخ" value={list.to} />
          </>
        }
      />
      {page.items.length === 0 ? (
        <EmptyState
          variant="inline"
          title={filtered ? "لا توجد عمليات مطابقة" : "لا توجد عمليات مسجلة بعد"}
          description={filtered ? "غيّر التصفية أو نطاق التاريخ، أو امسح التصفية لعرض السجل كاملًا." : "تظهر هنا عمليات الدخول والتعديل فور حدوثها."}
        />
      ) : (
        <>
          <DataTable caption="سجل التدقيق" minWidth="60rem">
            <THead>
              <SortHeader label="التاريخ والوقت" column="createdAt" current="createdAt" dir={list.dir} path={PATH} params={params} className={SORT_TH} />
              <Th>المنفّذ</Th>
              <Th>العملية</Th>
              <Th>السجل</Th>
              <Th>عنوان IP</Th>
            </THead>
            <tbody>
              {page.items.map((r) => {
                const hasDetail = r.before !== null || r.after !== null;
                return (
                  <Tr key={r.id}>
                    <Td className="w-64">
                      <DateDisplay date={r.createdAt} withTime />
                    </Td>
                    <Td>
                      {r.actorName ?? <span className="text-ink-subtle">النظام</span>}
                      {r.actorUsername ? (
                        <span className="t-caption mt-0.5 block">
                          <bdi dir="ltr">{r.actorUsername}</bdi>
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="font-semibold text-ink">{auditActionLabel(r.action)}</span>
                      {hasDetail ? (
                        <details className="mt-1.5 group">
                          <summary className="cursor-pointer text-xs text-primary hover:underline">عرض التفاصيل</summary>
                          <div className="mt-2 rounded-sm border border-line bg-surface-muted px-3 py-2">
                            <AuditChanges before={r.before} after={r.after} />
                          </div>
                        </details>
                      ) : null}
                    </Td>
                    <Td>
                      {auditEntityLabel(r.entityType)}
                      {r.entityId ? (
                        <span className="t-caption mt-0.5 block">
                          {r.entityType === "Request" ? (
                            <Link href={`/admin/requests/${r.entityId}`} className="text-primary hover:underline">
                              <bdi dir="ltr">{r.entityId.slice(-8)}</bdi>
                            </Link>
                          ) : (
                            <bdi dir="ltr">{r.entityType === "Setting" ? r.entityId : r.entityId.slice(-8)}</bdi>
                          )}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      {r.ip ? <bdi dir="ltr">{r.ip}</bdi> : <span className="text-ink-subtle">—</span>}
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
