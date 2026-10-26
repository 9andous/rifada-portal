import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
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
              { label: "الجمعيات", value: formatNumber(figures.total) },
              { label: "النشطة", value: formatNumber(figures.active) },
              { label: "المعطلة", value: formatNumber(figures.inactive) },
              { label: "بلا حساب مسؤول", value: formatNumber(figures.withoutOfficer), caption: "حساب واحد لكل جمعية" },
            ]}
          />
        }
      />
      <PageBody>
        <Suspense fallback={<ListSkeleton />}>
          <AssociationsList actor={user} searchParams={searchParams} basePath="/admin/associations" readOnly={false} />
        </Suspense>
      </PageBody>
    </>
  );
}
