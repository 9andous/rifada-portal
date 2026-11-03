import type { Metadata } from "next";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { EmptyState } from "@/components/states/states";
import { NewRequestTypeButton, RequestTypesList } from "@/components/taxonomy/request-types-editor";
import { TaxonomyNav } from "@/components/taxonomy/taxonomy-nav";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { listRequestTypes } from "@/server/services/admin/request-types";

export const metadata: Metadata = { title: "أنواع الطلبات" };

/** «أنواع الطلبات» (D-123): what an association can ask for when it submits a request. */
export default async function AdminRequestTypesPage() {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.manage")) return <ForbiddenPage />;
  const types = await listRequestTypes(user);

  return (
    <>
      <PageBand compact title="أنواع الطلبات" lead="تختار الجمعية نوع الطلب مع المسار المستهدف عند تقديم كل طلب. لا يُحذف نوع نهائيًا؛ يُوقَف أو يُؤرشَف، وتبقى الطلبات المقدَّمة به كما هي." />
      <PageBody>
        <TaxonomyNav active="request-types" base="/admin/taxonomy" />
        <Panel>
          <PanelHeader title="أنواع الطلبات" description="بالترتيب الذي تظهر به للجمعيات" actions={<NewRequestTypeButton />} />
          {types.length === 0 ? (
            <EmptyState variant="inline" title="لا توجد أنواع طلبات بعد" description="أضف نوعًا واحدًا على الأقل لتتمكن الجمعيات من تقديم الطلبات." />
          ) : (
            <RequestTypesList types={types} />
          )}
        </Panel>
      </PageBody>
    </>
  );
}
