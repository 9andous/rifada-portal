import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { TaxonomyNav } from "@/components/taxonomy/taxonomy-nav";
import { TemplatesList } from "@/components/templates/templates-list";
import { buttonClasses } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { templateFigures } from "@/server/services/admin/templates";

export const metadata: Metadata = { title: "النماذج" };

export default async function AdminTemplatesPage({ searchParams }: PageProps<"/admin/taxonomy/templates">) {
  const user = await requireUser();
  if (!can(user.role, "content.manage")) return <ForbiddenPage />;
  const figures = await templateFigures(user);

  return (
    <>
      <PageBand
        compact
        title="النماذج"
        lead="ملفات تنزّلها الجمعيات لتعبئتها وإرفاقها بطلباتها. لا يظهر النموذج إلا بعد نشره، ولا يُحذف؛ يُؤرشف ويبقى سجل ملفاته."
        actions={
          <Link href="/admin/taxonomy/templates/new" className={buttonClasses("onBand")}>
            <Plus strokeWidth={1.75} aria-hidden="true" />
            نموذج جديد
          </Link>
        }
        figures={
          <BandFigures
            items={[
              { label: "المنشورة", value: formatNumber(figures.published), caption: "تظهر لكل من يسجل الدخول" },
              { label: "غير المنشورة", value: formatNumber(figures.unpublished) },
              { label: "المؤرشفة", value: formatNumber(figures.archived) },
            ]}
          />
        }
      />
      <PageBody>
        <TaxonomyNav active="templates" base="/admin/taxonomy" />
        <Suspense fallback={<ListSkeleton />}>
          <TemplatesList actor={user} searchParams={searchParams} path="/admin/taxonomy/templates" view="admin" />
        </Suspense>
      </PageBody>
    </>
  );
}
