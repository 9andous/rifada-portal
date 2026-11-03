import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, CircleCheck, CircleSlash, Plus, UserRoundX } from "lucide-react";
import { AssociationsList } from "@/components/admin/associations-list";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { buttonClasses } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { associationFigures } from "@/server/services/admin/associations";

export const metadata: Metadata = { title: "الجمعيات" };

const PATH = "/admin/associations";

export default async function AdminAssociationsPage({ searchParams }: PageProps<"/admin/associations">) {
  const user = await requireUser();
  if (!can(user.role, "associations.manage")) return <ForbiddenPage />;
  const figures = await associationFigures(user);

  return (
    <>
      <PageBand
        compact
        title="الجمعيات"
        lead="سجل الجمعيات المشرف عليها وحساب المسؤول الوحيد لكل جمعية."
        actions={
          <Link href="/admin/associations/new" className={buttonClasses("onBand")}>
            <Plus strokeWidth={1.75} aria-hidden="true" />
            جمعية جديدة
          </Link>
        }
        figures={
          <BandFigures
            items={[
              { label: "الجمعيات", icon: Building2, value: formatNumber(figures.total), caption: "المسجلة في المنصة" },
              { label: "النشطة", icon: CircleCheck, tone: "ok", value: formatNumber(figures.active), caption: "تقدّم طلباتها", href: `${PATH}?status=active` },
              { label: "المعطلة", icon: CircleSlash, tone: "neutral", value: formatNumber(figures.inactive), caption: "موقوفة عن التقديم", href: `${PATH}?status=inactive` },
              {
                label: "بلا حساب مسؤول",
                icon: UserRoundX,
                attention: figures.withoutOfficer > 0 && "warn",
                value: formatNumber(figures.withoutOfficer),
                caption: "حساب واحد لكل جمعية",
                href: `${PATH}?officer=without`,
              },
            ]}
          />
        }
      />
      <PageBody>
        <Suspense fallback={<ListSkeleton />}>
          <AssociationsList actor={user} searchParams={searchParams} basePath={PATH} readOnly={false} />
        </Suspense>
      </PageBody>
    </>
  );
}
