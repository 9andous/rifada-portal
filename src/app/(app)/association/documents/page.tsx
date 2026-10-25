import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { TemplatesList } from "@/components/templates/templates-list";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";

export const metadata: Metadata = { title: "المستندات" };

export default async function AssociationDocumentsPage({ searchParams }: PageProps<"/association/documents">) {
  const user = await requireUser();
  if (!can(user.role, "templates.read")) return <ForbiddenPage />;

  return (
    <>
      <PageBand compact title="المستندات" lead="النماذج التي تنشرها الوحدة الإشرافية لتنزيلها وتعبئتها وإرفاقها بطلباتكم." />
      <PageBody>
        <Suspense fallback={<ListSkeleton />}>
          <TemplatesList actor={user} searchParams={searchParams} path="/association/documents" view="reader" />
        </Suspense>
      </PageBody>
    </>
  );
}
