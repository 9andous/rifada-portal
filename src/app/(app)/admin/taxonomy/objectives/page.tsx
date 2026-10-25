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

export default async function AdminObjectivesPage() {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.manage")) return <ForbiddenPage />;
  const objectives = await listObjectives(user);

  return (
    <>
      <PageBand compact title="الأهداف الإستراتيجية" lead="الأهداف السبعة من إستراتيجية الرئاسة. يُعدَّل العنوان والوصف فقط؛ لا تُضاف أهداف ولا تُؤرشف، لأن مصفوفة المبادرات مبنية عليها." />
      <PageBody>
        <TaxonomyNav active="objectives" base="/admin/taxonomy" />
        <Panel>
          <PanelHeader title="الأهداف" />
          {objectives.length === 0 ? (
            <EmptyState variant="inline" title="لا توجد أهداف محمّلة" description="تُحمَّل الأهداف من البيانات الأساسية عند تهيئة قاعدة البيانات." />
          ) : (
            <ObjectivesList objectives={objectives} readOnly={false} />
          )}
        </Panel>
      </PageBody>
    </>
  );
}
