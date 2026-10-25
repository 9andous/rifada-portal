import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { EmptyState } from "@/components/states/states";
import { InitiativesSection, MatrixSection } from "@/components/taxonomy/program-sections";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Panel } from "@/components/ui/surface";
import { TabNav } from "@/components/ui/tab-nav";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { firstParam, type SearchParams } from "@/lib/list-params";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { getProgramDetail, type ProgramDetail } from "@/server/services/admin/taxonomy-editor";

export const metadata: Metadata = { title: "البرنامج" };

const TABS = ["initiatives", "matrix", "goals"] as const;
type Tab = (typeof TABS)[number];

export default async function ManagerProgramPage({ params, searchParams }: PageProps<"/manager/taxonomy/programs/[number]">) {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.read")) return <ForbiddenPage />;
  const n = Number.parseInt((await params).number, 10);
  const program = Number.isInteger(n) ? await getProgramDetail(user, n, false) : null;
  if (!program) notFound();

  return (
    <>
      <PageBand
        compact
        eyebrow={`البرنامج ${toArabicDigits(program.number)}`}
        title={program.name}
        lead={program.officialName ?? undefined}
        actions={
          <Link href="/manager/taxonomy" className={buttonClasses("onBand")}>
            <ArrowRight strokeWidth={1.75} aria-hidden="true" />
            البرامج
          </Link>
        }
        figures={
          <BandFigures
            items={[
              { label: "المبادرات", value: formatNumber(program.activeInitiatives), emphasis: true },
              { label: "الأهداف", value: formatNumber(program.goals.length) },
            ]}
          />
        }
      />
      <PageBody>
        {program.state === "paused" ? (
          <Alert tone="warning" className="mb-6" title="البرنامج موقوف">
            لا تُقبل طلبات جديدة على البرنامج ولا على مبادراته حتى يعيد مدير النظام تشغيله.
          </Alert>
        ) : null}
        <Suspense fallback={<ListSkeleton />}>
          <Tabs user={user} program={program} searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}

async function Tabs({ user, program, searchParams }: { user: CurrentUser; program: ProgramDetail; searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(firstParam(params, "tab") ?? "") ? (firstParam(params, "tab") as Tab) : "initiatives";
  const path = `/manager/taxonomy/programs/${program.number}`;

  return (
    <Panel>
      <TabNav
        label="أقسام البرنامج"
        active={tab}
        items={[
          { key: "initiatives", label: "المبادرات", href: `${path}?tab=initiatives`, count: formatNumber(program.activeInitiatives) },
          { key: "matrix", label: "مصفوفة الأهداف", href: `${path}?tab=matrix` },
          { key: "goals", label: "أهداف البرنامج", href: `${path}?tab=goals`, count: formatNumber(program.goals.length) },
        ]}
      />
      <div className="pt-5">
        {tab === "initiatives" ? (
          <InitiativesSection actor={user} programId={program.id} params={params} path={path} initiativeBase="/manager/taxonomy/initiatives" editor={false} />
        ) : tab === "matrix" ? (
          <MatrixSection actor={user} programId={program.id} params={params} path={path} initiativeBase="/manager/taxonomy/initiatives" editor={false} />
        ) : program.goals.length === 0 ? (
          <EmptyState variant="inline" title="لا توجد أهداف لهذا البرنامج" />
        ) : (
          <ol className="flex flex-col pb-2">
            {program.goals.map((g) => (
              <li key={g.id} className="grid grid-cols-[2rem_1fr] gap-3 border-t border-line px-6 py-3 text-sm leading-relaxed">
                <span className="t-figure font-bold text-accent-ink">{toArabicDigits(g.number)}</span>
                <span className="text-ink">{g.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}
