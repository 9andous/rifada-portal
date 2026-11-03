import type { Metadata } from "next";
import { ArrowLeftRight, CircleDot, Zap } from "lucide-react";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { LifecyclePanels } from "@/components/workflow/lifecycle-panels";
import { formatNumber } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { getLifecycle } from "@/server/services/admin/statuses";

export const metadata: Metadata = { title: "حالات الطلبات" };

export default async function StatusesPage() {
  const user = await requireUser();
  if (!can(user.role, "settings.manage")) return <ForbiddenPage />;
  const lifecycle = await getLifecycle(user);
  const automatic = lifecycle.transitions.filter((t) => t.isAutomatic).length;

  return (
    <>
      <PageBand
        compact
        title="حالات الطلبات"
        lead="أسماء الحالات وألوانها وترتيبها، والانتقالات المسموح بها بينها ومن ينفذها. كل تغيير يُتحقق من صحة دورة الطلب قبل حفظه ويُسجَّل في سجل التدقيق."
        figures={
          <BandFigures
            items={[
              { label: "الحالات", icon: CircleDot, value: formatNumber(lifecycle.statuses.length), caption: "ثابتة" },
              { label: "الانتقالات", icon: ArrowLeftRight, tone: "info", value: formatNumber(lifecycle.transitions.length), caption: "بين الحالات" },
              { label: "التلقائية", icon: Zap, tone: "gold", value: formatNumber(automatic), caption: "ينفذها النظام" },
            ]}
          />
        }
      />
      <PageBody>
        <SettingsTabs active="statuses" />
        <LifecyclePanels lifecycle={lifecycle} readOnly={false} />
      </PageBody>
    </>
  );
}
