import type { Metadata } from "next";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { EmptyState } from "@/components/states/states";
import { ObjectivesList } from "@/components/taxonomy/objectives-editor";
import { TaxonomyNav } from "@/components/taxonomy/taxonomy-nav";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { listObjectives } from "@/server/services/admin/taxonomy-editor";

export const metadata: Metadata = { title: "الأهداف الإستراتيجية" };

export default async function ManagerObjectivesPage() {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.read")) return <ForbiddenPage />;
  const objectives = await listObjectives(user, false);

  return (
    <>
      <PageBand compact title="الأهداف الإستراتيجية" lead="الأهداف السبعة من إستراتيجية الرئاسة، وعدد المبادرات المرتبطة بكل هدف." />
      <PageBody>
        <TaxonomyNav active="objectives" base="/manager/taxonomy" />
        <Panel>
          <PanelHeader title="الأهداف" />
          {objectives.length === 0 ? <EmptyState variant="inline" title="لا توجد أهداف محمّلة" /> : <ObjectivesList objectives={objectives} readOnly />}
        </Panel>
      </PageBody>
    </>
  );
}
