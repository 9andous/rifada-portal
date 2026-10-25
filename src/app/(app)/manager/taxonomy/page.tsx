import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { ProgramsList } from "@/components/taxonomy/programs-list";
import { TaxonomyNav } from "@/components/taxonomy/taxonomy-nav";
import { formatNumber } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { taxonomyFigures } from "@/server/services/admin/taxonomy-editor";

export const metadata: Metadata = { title: "البرامج والمبادرات" };

export default async function ManagerTaxonomyPage({ searchParams }: PageProps<"/manager/taxonomy">) {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.read")) return <ForbiddenPage />;
  const figures = await taxonomyFigures(user, false);

  return (
    <>
      <PageBand
        compact
        title="البرامج والمبادرات"
        lead="برامج الرئاسة وأهدافها ومبادراتها ومتطلبات كل مبادرة، للاطلاع. يتولى مدير النظام التعديل."
        figures={
          <BandFigures
            items={[
              { label: "البرامج", value: formatNumber(figures.programs) },
              { label: "المبادرات", value: formatNumber(figures.initiatives), emphasis: true },
              { label: "روابط الأهداف", value: formatNumber(figures.links) },
              { label: "متطلبات المبادرات", value: formatNumber(figures.requirements) },
            ]}
          />
        }
      />
      <PageBody>
        <TaxonomyNav active="programs" base="/manager/taxonomy" />
        <Suspense fallback={<ListSkeleton rows={7} />}>
          <ProgramsList actor={user} searchParams={searchParams} base="/manager/taxonomy" editor={false} />
        </Suspense>
      </PageBody>
    </>
  );
}
