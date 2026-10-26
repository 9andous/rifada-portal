import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { AssignmentTable, type AssignmentRow } from "@/components/requests/assignment-table";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { EmptyState } from "@/components/states/states";
import { PersonName } from "@/components/ui/avatar";
import { DateDisplay } from "@/components/ui/date-display";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { DataTable, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { statusTone } from "@/lib/workflow";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { assignmentOverview, supervisorOptions } from "@/server/services/requests/assignment";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "الإسناد" };

type OverviewRow = Awaited<ReturnType<typeof assignmentOverview>>["unassigned"][number] & { assignedSupervisor?: { name: string } | null };

const toRow = (r: OverviewRow): AssignmentRow => ({
  id: r.id,
  referenceNo: r.referenceNo,
  title: r.title,
  program: { id: r.programId, number: r.program.number, name: r.program.name },
  association: r.association.name,
  status: { name: r.status.name, tone: statusTone(r.status.colorToken) },
  submittedAt: r.submittedAt,
  supervisor: r.assignedSupervisor?.name ?? null,
});

export default async function AssignmentPage() {
  const user = await requireUser();
  if (!can(user.role, "requests.assign")) return <ForbiddenPage />;
  const [overview, supervisors, max] = await Promise.all([assignmentOverview(user), supervisorOptions(user), getSetting("bulk.maxItems")]);
  const openBy = new Map(overview.loads.flatMap((l) => l.supervisors.map((s) => [s.id, s.open] as const)));
  const choices = supervisors.map((s) => ({ ...s, open: openBy.get(s.id) ?? 0 }));
  const programsWithoutSupervisor = overview.loads.filter((l) => l.supervisors.length === 0);

  return (
    <>
      <PageBand
        compact
        title="الإسناد"
        lead="الطلبات المفتوحة بلا مشرف أو المسندة إلى حساب معطل، وأعباء المشرفين في كل برنامج. يُسند كل طلب تلقائيًا عند تقديمه إلى أقل المشرفين طلبات مفتوحة."
        figures={
          <BandFigures
            items={[
              { label: "غير مسندة", value: formatNumber(overview.unassigned.length), attention: overview.unassigned.length > 0 && "warn", caption: "طلبات مفتوحة بلا مشرف" },
              { label: "لدى حسابات معطلة", value: formatNumber(overview.inactiveAssigned.length), caption: "تحتاج إلى إعادة إسناد" },
              { label: "المشرفون النشطون", value: formatNumber(supervisors.length) },
              { label: "برامج بلا مشرف", value: formatNumber(programsWithoutSupervisor.length), caption: "تبقى طلباتها غير مسندة" },
            ]}
          />
        }
      />
      <PageBody>
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title="طلبات بلا مشرف" description="اختر طلبًا أو أكثر ثم أسندها إلى مشرف نشط في برنامجها مع ذكر السبب." />
            {overview.unassigned.length === 0 ? (
              <EmptyState variant="inline" icon={<CircleCheck strokeWidth={1.75} />} title="لا توجد طلبات غير مسندة" description="جميع الطلبات المفتوحة مسندة إلى مشرفين." />
            ) : (
              <AssignmentTable rows={overview.unassigned.map(toRow)} supervisors={choices} caption="طلبات بلا مشرف" max={max} />
            )}
          </Panel>

          {overview.inactiveAssigned.length > 0 ? (
            <Panel>
              <PanelHeader title="طلبات لدى حسابات معطلة" description="عُطِّل حساب المشرف المسند إليه الطلب؛ أعد إسناده." />
              <AssignmentTable rows={overview.inactiveAssigned.map(toRow)} supervisors={choices} caption="طلبات لدى حسابات معطلة" max={max} />
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader title="أعباء المشرفين" description="الطلبات المفتوحة لكل مشرف نشط في كل برنامج، بترتيب الإسناد التلقائي." />
            <DataTable caption="أعباء المشرفين" minWidth="44rem">
              <THead>
                <Th className="w-72">البرنامج</Th>
                <Th>المشرف</Th>
                <Th>الطلبات المفتوحة</Th>
                <Th>آخر إسناد</Th>
              </THead>
              <tbody>
                {overview.loads.map((l) =>
                  l.supervisors.length === 0 ? (
                    <Tr key={l.program.id}>
                      <Td>
                        {toArabicDigits(l.program.number)}. {l.program.name}
                      </Td>
                      <Td colSpan={3} className="text-st-warn">
                        لا يوجد مشرف نشط؛ تبقى طلبات هذا البرنامج غير مسندة.
                      </Td>
                    </Tr>
                  ) : (
                    l.supervisors.map((s, i) => (
                      <Tr key={`${l.program.id}-${s.id}`}>
                        <Td>{i === 0 ? `${toArabicDigits(l.program.number)}. ${l.program.name}` : null}</Td>
                        <Td>
                          <PersonName name={s.name} />
                          {i === 0 ? <span className="t-caption ms-9 block">التالي في الإسناد التلقائي</span> : null}
                        </Td>
                        <Td className="t-figure">{formatNumber(s.open)}</Td>
                        <Td>{s.lastAssignedAt ? <DateDisplay date={s.lastAssignedAt} withTime /> : <span className="text-ink-subtle">لم يُسند إليه بعد</span>}</Td>
                      </Tr>
                    ))
                  ),
                )}
              </tbody>
            </DataTable>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
