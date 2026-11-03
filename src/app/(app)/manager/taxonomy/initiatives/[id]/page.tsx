import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { RequirementsEditor } from "@/components/taxonomy/requirements-editor";
import { buttonClasses } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { GENERAL_REQUEST_FIELDS } from "@/lib/validation/taxonomy";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { listRequirements } from "@/server/services/admin/requirements";
import { getInitiativeDetail } from "@/server/services/admin/taxonomy-editor";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "المبادرة" };

export default async function ManagerInitiativePage({ params }: PageProps<"/manager/taxonomy/initiatives/[id]">) {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.read")) return <ForbiddenPage />;
  const { id } = await params;
  const initiative = await getInitiativeDetail(user, id, false);
  if (!initiative) notFound();
  const [requirements, allowedGroups] = await Promise.all([listRequirements(user, initiative.id, false), getSetting("uploads.allowedGroups")]);

  return (
    <>
      <PageBand
        compact
        eyebrow={`البرنامج ${toArabicDigits(initiative.program.number)}: ${initiative.program.name} · المبادرة ${toArabicDigits(initiative.number)}`}
        title={initiative.name}
        actions={
          <Link href={`/manager/taxonomy/programs/${initiative.program.number}`} className={buttonClasses("onBand")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            مبادرات البرنامج
          </Link>
        }
        figures={
          <BandFigures
            items={[
              { label: "الأهداف المرتبطة", value: formatNumber(initiative.linkedObjectives.length), caption: "من سبعة أهداف" },
              { label: "الحقول الخاصة", value: formatNumber(requirements.fields.length) },
              { label: "المرفقات المطلوبة", value: formatNumber(requirements.attachments.length) },
            ]}
          />
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_24rem]">
          <Panel>
            <PanelHeader title="متطلبات المبادرة" description={`إضافة إلى الحقول العامة لكل طلب: ${GENERAL_REQUEST_FIELDS.map((f) => f.label).join("، ")}.`} />
            <div className="px-6 pb-6">
              <RequirementsEditor
                initiativeId={initiative.id}
                fields={requirements.fields}
                attachments={requirements.attachments}
                activeTypes={[]}
                allowedGroups={[...allowedGroups]}
                programs={[]}
                readOnly
                readOnlyReason="view"
              />
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="الأهداف الإستراتيجية" />
            <ul className="flex flex-col gap-2 px-6 pb-6">
              {initiative.objectives.map((o) => {
                const linked = initiative.linkedObjectives.includes(o.number);
                return (
                  <li key={o.number} className={cn("grid grid-cols-[1.25rem_1.5rem_1fr] items-start gap-2 text-sm", !linked && "text-ink-subtle")}>
                    <span aria-hidden="true">{linked ? <Check strokeWidth={1.75} className="mt-0.5 size-4 text-primary" /> : null}</span>
                    <span className="t-figure text-accent-ink">{toArabicDigits(o.number)}</span>
                    <span>
                      {o.title}
                      <span className="sr-only">{linked ? "، مرتبطة" : "، غير مرتبطة"}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
