import type { Metadata } from "next";
import { Building2, CircleCheck, CircleSlash, UserRoundCheck } from "lucide-react";
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
              { label: "الجمعيات", icon: Building2, value: formatNumber(figures.total), caption: "المسجلة في المنصة" },
              { label: "النشطة", icon: CircleCheck, tone: "ok", value: formatNumber(figures.active), caption: "تقدّم طلباتها", href: "/manager/associations?status=active" },
              { label: "المعطلة", icon: CircleSlash, tone: "neutral", value: formatNumber(figures.inactive), caption: "موقوفة عن التقديم", href: "/manager/associations?status=inactive" },
              { label: "لها حساب مسؤول", icon: UserRoundCheck, tone: "info", value: formatNumber(figures.withOfficer), caption: "حساب واحد لكل جمعية", href: "/manager/associations?officer=with" },
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
