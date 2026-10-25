import type { Metadata } from "next";
import { Suspense } from "react";
import { AssociationsList } from "@/components/admin/associations-list";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { formatNumber } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { scopeFor } from "@/server/authz/permissions";
import { associationFigures } from "@/server/services/admin/associations";

export const metadata: Metadata = { title: "الجمعيات" };

export default async function ManagerAssociationsPage({ searchParams }: PageProps<"/manager/associations">) {
  const user = await requireUser();
  if (scopeFor(user.role, "associations.read") !== "all") return <ForbiddenPage />;
  const figures = await associationFigures(user);

  return (
    <>
      <PageBand
        compact
        title="الجمعيات"
        lead="سجل الجمعيات المشرف عليها، للاطلاع. يتولى مدير النظام التسجيل والتعديل."
        figures={
          <BandFigures
            items={[
              { label: "الجمعيات", value: formatNumber(figures.total) },
              { label: "النشطة", value: formatNumber(figures.active), emphasis: true },
              { label: "المعطلة", value: formatNumber(figures.inactive) },
              { label: "لها حساب مسؤول", value: formatNumber(figures.withOfficer) },
            ]}
          />
        }
      />
      <PageBody>
        <Suspense fallback={<ListSkeleton />}>
          <AssociationsList actor={user} searchParams={searchParams} basePath="/manager/associations" readOnly />
        </Suspense>
      </PageBody>
    </>
  );
}
