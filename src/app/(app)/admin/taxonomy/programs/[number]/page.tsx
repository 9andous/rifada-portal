import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { ProgramForm } from "@/components/taxonomy/entity-forms";
import { GoalsEditor } from "@/components/taxonomy/goals-editor";
import { InitiativesSection, MatrixSection } from "@/components/taxonomy/program-sections";
import { StateActions } from "@/components/taxonomy/state-actions";
import { StateMark } from "@/components/taxonomy/taxonomy-nav";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Panel, PanelHeader } from "@/components/ui/surface";
import { TabNav } from "@/components/ui/tab-nav";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { firstParam, type SearchParams } from "@/lib/list-params";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { setProgramActiveAction, setProgramArchivedAction, updateProgramAction } from "@/server/actions/admin/taxonomy";
import { getProgramDetail, type ProgramDetail } from "@/server/services/admin/taxonomy-editor";

export const metadata: Metadata = { title: "البرنامج" };

const TABS = ["initiatives", "matrix", "goals", "data"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminProgramPage({ params, searchParams }: PageProps<"/admin/taxonomy/programs/[number]">) {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.manage")) return <ForbiddenPage />;
  const { number } = await params;
  const n = Number.parseInt(number, 10);
  if (!Number.isInteger(n)) notFound();
  const program = await getProgramDetail(user, n);
  if (!program) notFound();
  const path = `/admin/taxonomy/programs/${program.number}`;

  return (
    <>
      <PageBand
        compact
        eyebrow={`البرنامج ${toArabicDigits(program.number)}`}
        title={program.name}
        lead={program.officialName ?? undefined}
        actions={
          <>
            <Link href={`${path}/new-initiative`} className={buttonClasses("onBand")}>
              <Plus strokeWidth={1.75} aria-hidden="true" />
              مبادرة جديدة
            </Link>
            <Link href="/admin/taxonomy" className={buttonClasses("onBand")}>
              <ArrowRight strokeWidth={1.75} aria-hidden="true" />
              البرامج
            </Link>
          </>
        }
        figures={
          <BandFigures
            items={[
              { label: "المبادرات", value: formatNumber(program.activeInitiatives), emphasis: true, caption: `المؤرشفة: ${formatNumber(program.archivedInitiatives)}` },
              { label: "الأهداف", value: formatNumber(program.goals.filter((g) => !g.archivedAt).length) },
              { label: "ترتيب العرض", value: formatNumber(program.sortOrder) },
            ]}
          />
        }
      />
      <PageBody>
        {program.state !== "active" ? (
          <Alert tone="warning" className="mb-6" title={program.state === "archived" ? "البرنامج مؤرشف" : "البرنامج موقوف"}>
            {program.state === "archived"
              ? "لا يظهر البرنامج ولا مبادراته في نموذج الطلب ولا في الصفحات العامة حتى يُستعاد."
              : "لا تُقبل طلبات جديدة على البرنامج ولا على مبادراته حتى يُعاد تشغيله؛ حالات المبادرات نفسها لم تتغير."}
          </Alert>
        ) : null}
        <Suspense fallback={<ListSkeleton />}>
          <ProgramTabs user={user} program={program} path={path} searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}

async function ProgramTabs({ user, program, path, searchParams }: { user: CurrentUser; program: ProgramDetail; path: string; searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(firstParam(params, "tab") ?? "") ? (firstParam(params, "tab") as Tab) : "initiatives";
  const goals = program.goals.map((g) => ({ id: g.id, number: g.number, text: g.text, sourceNote: g.sourceNote, archived: Boolean(g.archivedAt) }));

  return (
    <Panel>
      <TabNav
        label="أقسام البرنامج"
        active={tab}
        items={[
          { key: "initiatives", label: "المبادرات", href: `${path}?tab=initiatives`, count: formatNumber(program.activeInitiatives) },
          { key: "matrix", label: "مصفوفة الأهداف", href: `${path}?tab=matrix` },
          { key: "goals", label: "أهداف البرنامج", href: `${path}?tab=goals`, count: formatNumber(goals.filter((g) => !g.archived).length) },
          { key: "data", label: "بيانات البرنامج", href: `${path}?tab=data` },
        ]}
      />
      <div className="pt-5">
        {tab === "initiatives" ? (
          <InitiativesSection actor={user} programId={program.id} params={params} path={path} initiativeBase="/admin/taxonomy/initiatives" editor />
        ) : tab === "matrix" ? (
          <MatrixSection actor={user} programId={program.id} params={params} path={path} initiativeBase="/admin/taxonomy/initiatives" editor />
        ) : tab === "goals" ? (
          <div className="pb-2">
            <GoalsEditor programId={program.id} goals={goals} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 px-6 pb-6 lg:grid-cols-[1fr_20rem]">
            <ProgramForm
              mode="edit"
              action={updateProgramAction.bind(null, program.id)}
              defaults={{
                number: String(program.number),
                name: program.name,
                officialName: program.officialName ?? "",
                description: program.description ?? "",
                sortOrder: String(program.sortOrder),
              }}
            />
            <aside className="flex flex-col gap-4">
              <PanelHeader title="الحالة" flush />
              <StateMark state={program.state} kind="program" />
              {program.sourceNote ? <p className="t-caption whitespace-pre-line">{program.sourceNote}</p> : null}
              <StateActions
                noun="program"
                id={program.id}
                name={program.name}
                isActive={program.isActive}
                archived={Boolean(program.archivedAt)}
                affectedInitiatives={program.activeInitiatives}
                setActive={setProgramActiveAction}
                setArchived={setProgramArchivedAction}
              />
            </aside>
          </div>
        )}
      </div>
    </Panel>
  );
}
