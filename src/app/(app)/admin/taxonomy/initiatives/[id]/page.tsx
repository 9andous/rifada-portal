import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { InitiativeForm, ObjectiveLinksForm } from "@/components/taxonomy/entity-forms";
import { RequirementsEditor } from "@/components/taxonomy/requirements-editor";
import { StateActions } from "@/components/taxonomy/state-actions";
import { StateMark } from "@/components/taxonomy/taxonomy-nav";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Panel, PanelHeader } from "@/components/ui/surface";
import { TabNav } from "@/components/ui/tab-nav";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { firstParam, type SearchParams } from "@/lib/list-params";
import { GENERAL_REQUEST_FIELDS } from "@/lib/validation/taxonomy";
import { WORDING_SLIPS } from "@/lib/wording-review";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { setInitiativeActiveAction, setInitiativeArchivedAction, setInitiativeObjectivesAction, updateInitiativeAction } from "@/server/actions/admin/taxonomy";
import { activeAttachmentTypes } from "@/server/services/admin/attachment-types";
import { listRequirements } from "@/server/services/admin/requirements";
import { getInitiativeDetail, initiativePickerOptions, type InitiativeDetail } from "@/server/services/admin/taxonomy-editor";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "المبادرة" };

const TABS = ["data", "links", "requirements"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminInitiativePage({ params, searchParams }: PageProps<"/admin/taxonomy/initiatives/[id]">) {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.manage")) return <ForbiddenPage />;
  const { id } = await params;
  const initiative = await getInitiativeDetail(user, id);
  if (!initiative) notFound();
  const programPath = `/admin/taxonomy/programs/${initiative.program.number}`;
  const requirements = await listRequirements(user, initiative.id);

  return (
    <>
      <PageBand
        compact
        eyebrow={`البرنامج ${toArabicDigits(initiative.program.number)}: ${initiative.program.name} · المبادرة ${toArabicDigits(initiative.number)}`}
        title={initiative.name}
        actions={
          <Link href={`${programPath}?tab=initiatives`} className={buttonClasses("onBand")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            مبادرات البرنامج
          </Link>
        }
        figures={
          <BandFigures
            items={[
              { label: "الأهداف المرتبطة", value: formatNumber(initiative.linkedObjectives.length), caption: "من سبعة أهداف" },
              { label: "الحقول الخاصة", value: formatNumber(requirements.fields.length), emphasis: true },
              { label: "المرفقات المطلوبة", value: formatNumber(requirements.attachments.length) },
            ]}
          />
        }
      />
      <PageBody>
        {initiative.programState !== "active" ? (
          <Alert tone="warning" className="mb-6" title={initiative.programState === "archived" ? "البرنامج مؤرشف" : "البرنامج موقوف"}>
            لا تظهر هذه المبادرة في نموذج الطلب ما دام برنامجها {initiative.programState === "archived" ? "مؤرشفًا" : "موقوفًا"}، دون تغيير حالتها هي.
          </Alert>
        ) : null}
        <Suspense fallback={<ListSkeleton />}>
          <InitiativeTabs user={user} initiative={initiative} requirements={requirements} searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}

async function InitiativeTabs({
  user,
  initiative,
  requirements,
  searchParams,
}: {
  user: CurrentUser;
  initiative: InitiativeDetail;
  requirements: Awaited<ReturnType<typeof listRequirements>>;
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(firstParam(params, "tab") ?? "") ? (firstParam(params, "tab") as Tab) : "requirements";
  const path = `/admin/taxonomy/initiatives/${initiative.id}`;
  const slip = WORDING_SLIPS.find((s) => s.program === initiative.program.number && s.initiatives.some((i) => i.number === initiative.number && i.text === initiative.name));

  return (
    <Panel>
      <TabNav
        label="أقسام المبادرة"
        active={tab}
        items={[
          { key: "requirements", label: "المتطلبات", href: `${path}?tab=requirements` },
          { key: "links", label: "الأهداف الإستراتيجية", href: `${path}?tab=links`, count: formatNumber(initiative.linkedObjectives.length) },
          { key: "data", label: "بيانات المبادرة", href: `${path}?tab=data` },
        ]}
      />
      <div className="px-6 py-6">
        {tab === "requirements" ? (
          <RequirementsTab user={user} initiative={initiative} requirements={requirements} />
        ) : tab === "links" ? (
          <ObjectiveLinksForm action={setInitiativeObjectivesAction.bind(null, initiative.id)} objectives={initiative.objectives} linked={initiative.linkedObjectives} />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
            <InitiativeForm
              mode="edit"
              action={updateInitiativeAction.bind(null, initiative.id)}
              slipNote={slip?.note}
              defaults={{
                number: String(initiative.number),
                name: initiative.name,
                description: initiative.description ?? "",
                sourceNote: initiative.sourceNote ?? "",
              }}
            />
            <aside className="flex flex-col gap-4">
              <PanelHeader title="الحالة" flush />
              <StateMark state={initiative.state} kind="initiative" />
              <StateActions
                noun="initiative"
                id={initiative.id}
                name={initiative.name}
                isActive={initiative.isActive}
                archived={Boolean(initiative.archivedAt)}
                setActive={setInitiativeActiveAction}
                setArchived={setInitiativeArchivedAction}
              />
            </aside>
          </div>
        )}
      </div>
    </Panel>
  );
}

async function RequirementsTab({
  user,
  initiative,
  requirements,
}: {
  user: CurrentUser;
  initiative: InitiativeDetail;
  requirements: Awaited<ReturnType<typeof listRequirements>>;
}) {
  const [types, programs, allowedGroups] = await Promise.all([activeAttachmentTypes(user), initiativePickerOptions(user), getSetting("uploads.allowedGroups")]);
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="general-fields" className="rounded-sm border border-line bg-surface-muted px-5 py-4">
        <h3 id="general-fields" className="t-label">
          الحقول العامة لكل طلب (ثابتة، ولا تُعدّل هنا)
        </h3>
        <p className="mt-2 text-sm text-ink-muted">{GENERAL_REQUEST_FIELDS.map((f) => f.label).join("، ")}</p>
      </section>
      <RequirementsEditor
        initiativeId={initiative.id}
        fields={requirements.fields}
        attachments={requirements.attachments}
        activeTypes={types}
        allowedGroups={[...allowedGroups]}
        programs={programs}
        readOnly={Boolean(initiative.archivedAt)}
      />
    </div>
  );
}
