import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck, PenLine, Plus } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { ListSkeleton } from "@/components/states/list-skeleton";
import { ProgramsList } from "@/components/taxonomy/programs-list";
import { TaxonomyNav } from "@/components/taxonomy/taxonomy-nav";
import { buttonClasses } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/surface";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { taxonomyFigures, wordingReview } from "@/server/services/admin/taxonomy-editor";

export const metadata: Metadata = { title: "البرامج والمبادرات" };

export default async function TaxonomyPage({ searchParams }: PageProps<"/admin/taxonomy">) {
  const user = await requireUser();
  if (!can(user.role, "taxonomy.manage")) return <ForbiddenPage />;
  const figures = await taxonomyFigures(user);

  return (
    <>
      <PageBand
        compact
        title="البرامج والمبادرات"
        lead="برامج الرئاسة وأهدافها ومبادراتها وارتباطها بالأهداف الإستراتيجية، ومتطلبات كل مبادرة. لا يُحذف شيء نهائيًا؛ يُوقَف أو يُؤرشَف."
        actions={
          <Link href="/admin/taxonomy/programs/new" className={buttonClasses("onBand")}>
            <Plus strokeWidth={1.75} aria-hidden="true" />
            برنامج جديد
          </Link>
        }
        figures={
          <BandFigures
            items={[
              { label: "البرامج", value: formatNumber(figures.programs), caption: figures.paused ? `منها موقوف: ${formatNumber(figures.paused)}` : "غير المؤرشفة" },
              { label: "المبادرات", value: formatNumber(figures.initiatives) },
              { label: "روابط الأهداف", value: formatNumber(figures.links) },
              { label: "أنواع المرفقات", value: formatNumber(figures.attachmentTypes) },
              { label: "متطلبات المبادرات", value: formatNumber(figures.requirements), caption: "حقول ومرفقات" },
            ]}
          />
        }
      />
      <PageBody>
        <TaxonomyNav active="programs" base="/admin/taxonomy" />
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_24rem]">
          <Suspense fallback={<ListSkeleton rows={7} />}>
            <ProgramsList actor={user} searchParams={searchParams} base="/admin/taxonomy" editor />
          </Suspense>
          <WordingPanel user={user} />
        </div>
      </PageBody>
    </>
  );
}

/** The wording slips listed in docs/COPY-REVIEW.md, each one edit away. Nothing changes automatically. */
async function WordingPanel({ user }: { user: CurrentUser }) {
  const slips = await wordingReview(user);
  const open = slips.flatMap((s) => s.initiatives).filter((i) => !i.resolved).length;

  return (
    <Panel>
      <PanelHeader
        title="صياغات بانتظار مراجعتكم"
        description={open ? `أسماء نُقلت كما وردت في الوثيقة وتحتاج قرارًا. المتبقي: ${formatNumber(open)}` : "رُوجعت جميع الصياغات المدرجة."}
      />
      <ol className="flex flex-col px-6 pb-4">
        {slips.map((slip, index) => (
          <li key={index} className="border-t border-line py-3 first:border-0 first:pt-0">
            {slip.initiatives.map((i) => (
              <div key={i.number} className="flex items-start justify-between gap-3 py-1">
                <div className="min-w-0 text-sm">
                  <p className="t-caption">
                    البرنامج {toArabicDigits(slip.program)}، المبادرة {toArabicDigits(i.number)}
                  </p>
                  <p className={i.resolved ? "text-ink-subtle" : "text-ink"}>{i.current ?? i.text}</p>
                </div>
                {i.resolved ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-st-ok">
                    <CircleCheck aria-hidden="true" strokeWidth={1.75} className="size-4" />
                    عُدّلت
                  </span>
                ) : i.id ? (
                  <Link href={`/admin/taxonomy/initiatives/${i.id}?tab=data&slip=1`} className={buttonClasses("outline", "sm")}>
                    <PenLine aria-hidden="true" strokeWidth={1.75} />
                    تعديل
                  </Link>
                ) : null}
              </div>
            ))}
            <p className="t-caption mt-1">{slip.note}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
