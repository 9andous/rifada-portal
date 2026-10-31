import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { TemplatesLibrary } from "@/components/templates/templates-library";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";

export const metadata: Metadata = { title: "الأدلة والنماذج" };

export default async function SupervisorTemplatesPage({ searchParams }: PageProps<"/supervisor/templates">) {
  const user = await requireUser();
  if (!can(user.role, "templates.read")) return <ForbiddenPage />;

  return (
    <>
      <PageBand compact title="الأدلة والنماذج" lead="الأدلة والنماذج المنشورة للجمعيات، للاطلاع والتنزيل." />
      <PageBody>
        <Suspense fallback={<ListSkeleton />}>
          <TemplatesLibrary actor={user} searchParams={searchParams} path="/supervisor/templates" />
        </Suspense>
      </PageBody>
    </>
  );
}
