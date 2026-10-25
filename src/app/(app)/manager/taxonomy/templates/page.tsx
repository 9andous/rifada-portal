import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { TaxonomyNav } from "@/components/taxonomy/taxonomy-nav";
import { TemplatesList } from "@/components/templates/templates-list";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";

export const metadata: Metadata = { title: "النماذج" };

export default async function ManagerTemplatesPage({ searchParams }: PageProps<"/manager/taxonomy/templates">) {
  const user = await requireUser();
  if (!can(user.role, "templates.read")) return <ForbiddenPage />;

  return (
    <>
      <PageBand compact title="النماذج" lead="النماذج المنشورة للجمعيات، للاطلاع والتنزيل. يتولى مدير النظام إضافتها ونشرها." />
      <PageBody>
        <TaxonomyNav active="templates" base="/manager/taxonomy" />
        <Suspense fallback={<ListSkeleton />}>
          <TemplatesList actor={user} searchParams={searchParams} path="/manager/taxonomy/templates" view="reader" />
        </Suspense>
      </PageBody>
    </>
  );
}
