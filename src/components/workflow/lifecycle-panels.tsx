import { Alert, Panel, PanelHeader } from "@/components/ui/surface";
import { formatNumber } from "@/lib/format";
import type { Lifecycle } from "@/server/services/admin/statuses";
import { LifecycleDiagram } from "./lifecycle-diagram";
import { NewTransitionButton, ScopeNote, StatusesTable, TransitionsTable } from "./status-editors";

/** Statuses, transitions and the diagram; editable for the super admin, read-only for the unit manager. */
export function LifecyclePanels({ lifecycle, readOnly }: { lifecycle: Lifecycle; readOnly: boolean }) {
  const { statuses, transitions, problems } = lifecycle;
  return (
    <div className="flex flex-col gap-6">
      {problems.length > 0 ? (
        <Alert tone="danger" title="دورة الطلب الحالية تخالف قواعدها">
          <ul className="list-inside list-disc">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <Panel>
        <PanelHeader title="دورة حياة الطلب" description="من «مسودة» حتى «مقبول» أو «مرفوض». الأسهم الخفيفة انتقالات تلقائية ينفذها النظام." />
        <div className="overflow-x-auto px-6 pb-6">
          <LifecycleDiagram statuses={statuses} transitions={transitions} className="min-w-[44rem]" />
        </div>
      </Panel>
      <div className="flex flex-col gap-6">
        <Panel>
          <PanelHeader title="الحالات" description={readOnly ? undefined : "الحالات السبع ثابتة: يُعدَّل اسمها ولونها وترتيبها فقط، ولا تُحذف."} />
          <StatusesTable statuses={statuses} readOnly={readOnly} />
        </Panel>
        <Panel>
          <PanelHeader
            title="الانتقالات"
            description={`عدد الانتقالات: ${formatNumber(transitions.length)}`}
            actions={readOnly ? undefined : <NewTransitionButton statuses={statuses} />}
          />
          <div className="px-6 pb-4">
            <ScopeNote />
          </div>
          <TransitionsTable statuses={statuses} transitions={transitions} readOnly={readOnly} />
        </Panel>
      </div>
    </div>
  );
}
