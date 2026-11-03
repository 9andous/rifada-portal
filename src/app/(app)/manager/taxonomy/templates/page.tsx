import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { TaxonomyNav } from "@/components/taxonomy/taxonomy-nav";
import { TemplatesLibrary } from "@/components/templates/templates-library";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";

export const metadata: Metadata = { title: "الأدلة والنماذج" };

export default async function ManagerTemplatesPage({ searchParams }: PageProps<"/manager/taxonomy/templates">) {
  const user = await requireUser();
  if (!can(user.role, "templates.read")) return <ForbiddenPage />;

  return (
    <>
      <PageBand compact title="الأدلة والنماذج" lead="الأدلة والنماذج المنشورة للجمعيات، للاطلاع والتنزيل. يتولى مدير النظام إضافتها ونشرها." />
      <PageBody>
        <TaxonomyNav active="templates" base="/manager/taxonomy" />
        <Suspense fallback={<ListSkeleton />}>
          <TemplatesLibrary actor={user} searchParams={searchParams} path="/manager/taxonomy/templates" />
        </Suspense>
      </PageBody>
    </>
  );
}
