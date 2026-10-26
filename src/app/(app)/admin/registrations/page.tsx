import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck, CircleX, Hourglass, UserPlus } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { EmptyState } from "@/components/states/states";
import { DateDisplay } from "@/components/ui/date-display";
import { Pagination } from "@/components/ui/pagination";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { TabNav } from "@/components/ui/tab-nav";
import { DataTable, THead, Td, Th, Tr } from "@/components/ui/table";
import type { RegistrationStatus } from "@/generated/prisma/client";
import { formatNumber, toArabicDigits } from "@/lib/format";
import type { SearchParams } from "@/lib/list-params";
import { REGISTRATION_STATUS } from "@/lib/registrations";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import type { CurrentUser } from "@/server/auth/session";
import { listRegistrations, registrationCounts } from "@/server/services/registrations";

export const metadata: Metadata = { title: "طلبات تسجيل الجمعيات" };

const TABS: { key: RegistrationStatus; label: string }[] = [
  { key: "PENDING", label: "قيد المراجعة" },
  { key: "APPROVED", label: "المعتمدة" },
  { key: "REJECTED", label: "المرفوضة" },
];

export default async function RegistrationsPage({ searchParams }: PageProps<"/admin/registrations">) {
  const user = await requireUser();
  if (!can(user.role, "registrations.review")) return <ForbiddenPage />;
  const counts = await registrationCounts(user);

  return (
    <>
      <PageBand
        compact
        title="طلبات تسجيل الجمعيات"
        lead="طلبات الجمعيات التي سجّلت من الموقع العام. اعتماد الطلب ينشئ الجمعية وحساب مسؤولها."
        figures={
          <BandFigures
            items={[
              { label: "قيد المراجعة", value: formatNumber(counts.PENDING), icon: <Hourglass strokeWidth={1.75} />, caption: "بانتظار القرار" },
              { label: "المعتمدة", value: formatNumber(counts.APPROVED), icon: <CircleCheck strokeWidth={1.75} />, tone: "ok" },
              { label: "المرفوضة", value: formatNumber(counts.REJECTED), icon: <CircleX strokeWidth={1.75} />, tone: "bad" },
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
      <PanelHeader icon={<UserPlus strokeWidth={1.75} />} title="الطلبات" description={`عدد النتائج: ${formatNumber(page.total)}`} className="mb-0!" />
      <TabNav
        label="حالة الطلب"
        active={status}
        items={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "PENDING" ? "/admin/registrations" : `/admin/registrations?status=${t.key}`, count: formatNumber(counts[t.key]) }))}
      />
      {page.items.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<UserPlus strokeWidth={1.75} />}
          title={status === "PENDING" ? "لا توجد طلبات بانتظار المراجعة" : "لا توجد طلبات في هذه القائمة"}
          description="تظهر هنا طلبات الجمعيات التي تسجّل من صفحة «تسجيل جمعية» في الموقع العام."
        />
      ) : (
        <>
          <DataTable caption="طلبات تسجيل الجمعيات" minWidth="52rem">
            <THead>
              <Th>الجمعية</Th>
              <Th>التصنيف</Th>
              <Th>الموقع</Th>
              <Th>المسؤول</Th>
              <Th>تاريخ التقديم</Th>
              <Th>الحالة</Th>
            </THead>
            <tbody>
              {page.items.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <Link href={`/admin/registrations/${r.id}`} className="font-semibold text-ink hover:text-primary hover:underline">
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
                  <Td className="max-w-[14rem] text-ink-muted">{r.classification}</Td>
                  <Td className="text-ink-muted">
                    {r.city}
                    <span className="t-caption block">{r.region}</span>
                  </Td>
                  <Td>{r.officerName}</Td>
                  <Td>
                    <DateDisplay date={r.createdAt} />
                  </Td>
                  <Td>
                    <StatusText tone={REGISTRATION_STATUS[r.status].tone}>{REGISTRATION_STATUS[r.status].label}</StatusText>
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
