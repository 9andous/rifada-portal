import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck, CircleX, ClipboardList, Hourglass, Link2, Plus } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { EmptyState } from "@/components/states/states";
import { DateDisplay } from "@/components/ui/date-display";
import { Pagination } from "@/components/ui/pagination";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { TabNav } from "@/components/ui/tab-nav";
import { DataTable, ROW_LINK, THead, Td, Th, Tr } from "@/components/ui/table";
import type { RegistrationStatus } from "@/generated/prisma/client";
import { buttonClasses } from "@/components/ui/button";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { siteLabel } from "@/lib/service-places";
import type { SearchParams } from "@/lib/list-params";
import { REGISTRATION_STATUS, inviteOpen } from "@/lib/registrations";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import type { CurrentUser } from "@/server/auth/session";
import { listRegistrations, registrationCounts } from "@/server/services/registrations";

export const metadata: Metadata = { title: "طلبات تسجيل الجمعيات" };

const TABS: { key: RegistrationStatus; label: string }[] = [
  { key: "PENDING", label: "قيد المراجعة" },
  { key: "INVITED", label: "بانتظار الجمعية" },
  { key: "APPROVED", label: "المعتمدة" },
  { key: "REJECTED", label: "المرفوضة" },
];

export default async function RegistrationsPage({ searchParams }: PageProps<"/admin/registrations">) {
  const user = await requireUser();
  if (!can(user.role, "registrations.review")) return <ForbiddenPage />;
  const [counts, params] = await Promise.all([registrationCounts(user), searchParams]);

  return (
    <>
      <PageBand
        compact
        title="طلبات تسجيل الجمعيات"
        lead="تُضاف الجمعية فيُنشأ لها رابط تسجيل تستكمل منه بياناتها، ثم يُراجع الطلب هنا. اعتماده ينشئ الجمعية وحسابها."
        actions={
          <Link href="/admin/associations/new" className={buttonClasses("gold")}>
            <Plus aria-hidden="true" strokeWidth={1.75} />
            جمعية جديدة
          </Link>
        }
        figures={
          <BandFigures
            params={params}
            items={[
              { label: "بانتظار الجمعية", icon: Link2, tone: "gold", value: formatNumber(counts.INVITED), caption: "رابط تسجيل لم يُستكمل", href: "/admin/registrations?status=INVITED" },
              { label: "قيد المراجعة", icon: Hourglass, value: formatNumber(counts.PENDING), attention: counts.PENDING > 0 && "warn", caption: "بانتظار القرار", href: "/admin/registrations" },
              { label: "المعتمدة", icon: CircleCheck, tone: "ok", value: formatNumber(counts.APPROVED), caption: "أُنشئت جمعياتها", href: "/admin/registrations?status=APPROVED" },
              { label: "المرفوضة", icon: CircleX, tone: "bad", value: formatNumber(counts.REJECTED), caption: "لم تُعتمد", href: "/admin/registrations?status=REJECTED" },
            ]}
          />
        }
      />
      <PageBody>
        <Suspense fallback={<ListSkeleton />}>
          <RegistrationsList user={user} counts={counts} searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}

async function RegistrationsList({ user, counts, searchParams }: { user: CurrentUser; counts: Record<RegistrationStatus, number>; searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const status = TABS.find((t) => t.key === params.status)?.key ?? "PENDING";
  const pageNo = Math.max(1, Number(params.page) || 1);
  const page = await listRegistrations(user, status, pageNo);

  return (
    <Panel>
      <PanelHeader title="الطلبات" description={`عدد النتائج: ${formatNumber(page.total)}`} className="mb-0!" />
      <TabNav
        label="حالة الطلب"
        active={status}
        items={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "PENDING" ? "/admin/registrations" : `/admin/registrations?status=${t.key}`, count: formatNumber(counts[t.key]) }))}
      />
      {page.items.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<ClipboardList strokeWidth={1.75} />}
          title={status === "PENDING" ? "لا توجد طلبات بانتظار المراجعة" : status === "INVITED" ? "لا توجد روابط بانتظار الجمعيات" : "لا توجد طلبات في هذه القائمة"}
          description="أضف جمعية من «جمعية جديدة» فيُنشأ لها رابط تسجيل، وتظهر بياناتها هنا بعد أن تستكملها."
        />
      ) : (
        <>
          <DataTable caption="طلبات تسجيل الجمعيات" minWidth="52rem">
            <THead>
              <Th>الجمعية</Th>
              <Th>{status === "INVITED" ? "البريد الإلكتروني" : "موقع الخدمة"}</Th>
              <Th>المسؤول الأول</Th>
              <Th>{status === "INVITED" ? "تاريخ الإنشاء" : "تاريخ التقديم"}</Th>
              <Th>{status === "INVITED" ? "الرابط" : "الحالة"}</Th>
            </THead>
            <tbody>
              {page.items.map((r) => (
                <Tr key={r.id} linked>
                  <Td>
                    <Link href={`/admin/registrations/${r.id}`} className={`font-semibold text-ink hover:text-primary hover:underline ${ROW_LINK}`}>
                      {r.name}
                    </Link>
                    <span className="t-caption mt-0.5 flex flex-wrap items-center gap-x-2">
                      <bdi dir="ltr" className="font-semibold text-primary">
                        {r.referenceNo}
                      </bdi>
                      <span aria-hidden="true">·</span>
                      ترخيص {toArabicDigits(r.licenseNumber)}
                    </span>
                  </Td>
                  <Td className="max-w-[16rem] text-ink-muted">
                    {status === "INVITED" ? (
                      <bdi dir="ltr">{r.contactEmail}</bdi>
                    ) : (
                      <>
                        {siteLabel(r.serviceSite) ?? "—"}
                        {r.classification ? <span className="t-caption block">{r.classification}</span> : null}
                      </>
                    )}
                  </Td>
                  <Td>{r.officerName}</Td>
                  <Td>
                    <DateDisplay date={status === "INVITED" ? r.createdAt : (r.submittedAt ?? r.createdAt)} />
                  </Td>
                  <Td>
                    {status === "INVITED" ? (
                      inviteOpen(r.inviteExpiresAt) ? (
                        <span className="flex flex-col gap-0.5">
                          <StatusText tone="ok">صالح</StatusText>
                          <span className="t-caption">
                            حتى <DateDisplay date={r.inviteExpiresAt} />
                          </span>
                        </span>
                      ) : (
                        <StatusText tone="bad">منتهي الصلاحية</StatusText>
                      )
                    ) : (
                      <StatusText tone={REGISTRATION_STATUS[r.status].tone}>{REGISTRATION_STATUS[r.status].label}</StatusText>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={page.page} pageCount={page.pageCount} pageSize={page.pageSize} total={page.total} path="/admin/registrations" params={params} />
        </>
      )}
    </Panel>
  );
}
