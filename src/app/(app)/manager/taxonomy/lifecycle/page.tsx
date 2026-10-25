import type { Metadata } from "next";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { TaxonomyNav } from "@/components/taxonomy/taxonomy-nav";
import { LifecyclePanels } from "@/components/workflow/lifecycle-panels";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { getLifecycle } from "@/server/services/admin/statuses";

export const metadata: Metadata = { title: "دورة حياة الطلب" };

export default async function ManagerLifecyclePage() {
  const user = await requireUser();
  if (!can(user.role, "statuses.read")) return <ForbiddenPage />;
  const lifecycle = await getLifecycle(user);

  return (
    <>
      <PageBand compact title="دورة حياة الطلب" lead="حالات الطلب والانتقالات بينها ومن ينفذ كل انتقال، للاطلاع. يتولى مدير النظام التعديل." />
      <PageBody>
        <TaxonomyNav active="lifecycle" base="/manager/taxonomy" />
        <LifecyclePanels lifecycle={lifecycle} readOnly />
      </PageBody>
    </>
  );
}
