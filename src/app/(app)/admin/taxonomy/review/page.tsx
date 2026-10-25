import type { Metadata } from "next";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { EmptyState, ForbiddenState } from "@/components/states/states";
import { ObjectiveCells, ObjectiveHeaderCells, ObjectiveLegend } from "@/components/taxonomy/objective-grid";
import { DateDisplay } from "@/components/ui/date-display";
import { PrintButton } from "@/components/ui/print-button";
import { Alert, Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { TAXONOMY_SOURCE } from "@/lib/taxonomy-source";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { getTaxonomyReview } from "@/server/services/taxonomy";

export const metadata: Metadata = { title: "مراجعة استخراج البرامج والمبادرات" };

/** Initiative counts per program as listed in the source document (Phase 1b acceptance). */
const EXPECTED_COUNTS: Record<number, number> = { 1: 13, 2: 30, 3: 26, 4: 16, 5: 13, 6: 27, 7: 18 };

export default async function TaxonomyReviewPage() {
  const user = await requireUser();
  if (!can(user.role, "admin.access")) {
    return (
      <>
        <PageBand title="غير مصرح" compact />
        <PageBody>
          <ForbiddenState />
        </PageBody>
      </>
    );
  }

  const review = await getTaxonomyReview(user);
  const { programs, objectives, uncertainCells, missing } = review;
  const initiativeCount = programs.reduce((sum, p) => sum + p.initiatives.length, 0);
  const changed = programs.flatMap((p) => p.initiatives.filter((i) => i.differsFromSource).map((i) => ({ program: p.number, ...i })));
  const fixes = TAXONOMY_SOURCE.programs.flatMap((p) => p.initiatives.filter((i) => i.sourceText).map((i) => ({ program: p.number, ...i })));
  const merged = TAXONOMY_SOURCE.programs.flatMap((p) => p.initiatives.filter((i) => i.mergedRows).map((i) => ({ program: p.number, ...i })));
  const now = new Date();

  return (
    <>
      <PageBand
        compact
        title="مراجعة استخراج البرامج والمبادرات"
        lead="قارن كل صف بالصفحة المذكورة من وثيقة الإستراتيجية قبل الانتقال إلى المرحلة التالية. قُرئ كل جدول مرتين قراءتين مستقلتين، وتظهر هنا أي خلية لم تتفق عليها القراءتان."
        actions={<PrintButton variant="onBand">طباعة الصفحة</PrintButton>}
        figures={
          <BandFigures
            items={[
              { label: "المبادرات", value: formatNumber(initiativeCount), caption: `المتوقع ${formatNumber(143)}` },
              { label: "روابط الأهداف", value: formatNumber(review.linkCount), caption: "علامات الاختيار في الجداول" },
              { label: "الخلايا المقروءة", value: formatNumber(review.cellsRead), caption: "قراءتان لكل خلية" },
              { label: "خلايا غير مؤكدة", value: formatNumber(uncertainCells.length), emphasis: true, caption: "تحتاج تحققًا من المصدر" },
            ]}
          />
        }
      />
      <PageBody className="print:max-w-none print:px-0 print:pb-0">
        <div className="mb-6 hidden print:block">
          <h1 className="t-page text-2xl">مراجعة استخراج البرامج والمبادرات</h1>
          <p className="t-caption mt-1">
            المصدر: {TAXONOMY_SOURCE.source} · طُبعت في <DateDisplay date={now} />
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.3fr_1fr] print:grid-cols-[1.3fr_1fr]">
          <Panel>
            <PanelHeader title="ملخص الأعداد" description="أعداد المبادرات في قاعدة البيانات مقارنة بوثيقة الإستراتيجية" />
            <table className="t-table w-full border-collapse">
              <thead className="bg-surface-muted">
                <tr>
                  <th scope="col" className="t-label py-2.5 ps-6 text-start">
                    البرنامج
                  </th>
                  <th scope="col" className="t-label py-2.5 text-center">
                    الأهداف
                  </th>
                  <th scope="col" className="t-label py-2.5 text-center">
                    المبادرات
                  </th>
                  <th scope="col" className="t-label py-2.5 text-center">
                    صفحة المصدر
                  </th>
                  <th scope="col" className="t-label py-2.5 pe-6 text-start">
                    المطابقة
                  </th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => {
                  const expected = EXPECTED_COUNTS[p.number];
                  const ok = expected === p.initiatives.length;
                  return (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 ps-6">
                        <span className="me-2 font-semibold text-ink-subtle">{toArabicDigits(p.number)}</span>
                        {p.name}
                      </td>
                      <td className="text-center">{formatNumber(p.goals.length)}</td>
                      <td className="text-center font-semibold">{formatNumber(p.initiatives.length)}</td>
                      <td className="text-center">{p.sourcePage ? toArabicDigits(p.sourcePage) : "—"}</td>
                      <td className="pe-6">
                        {ok ? (
                          <StatusText tone="ok">مطابق</StatusText>
                        ) : (
                          <StatusText tone="bad">المتوقع {expected ? formatNumber(expected) : "—"}</StatusText>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {missing.length > 0 ? (
              <div className="px-6 py-4">
                <Alert tone="danger" title={`${formatNumber(missing.length)} مبادرة من المصدر غير موجودة في قاعدة البيانات`}>
                  {missing.map((m) => `${toArabicDigits(m.program)}/${toArabicDigits(m.initiative)} ${m.name}`).join("، ")}
                </Alert>
              </div>
            ) : null}
          </Panel>

          <div className="flex flex-col gap-6">
            <Panel>
              <PanelHeader title="الخلايا غير المؤكدة" />
              {uncertainCells.length === 0 ? (
                <div className="flex items-start gap-4 px-6 pb-6 pt-1">
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-st-ok-soft text-st-ok [&_svg]:size-5">
                    <CircleCheck strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-sm font-bold">لا توجد خلايا غير مؤكدة</p>
                    <p className="t-caption mt-0.5 text-[0.8125rem]">
                      اتفقت القراءتان في جميع الخلايا البالغة {formatNumber(review.cellsRead)} خلية، ولم تُخمَّن أي علامة.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="px-6 pb-4">
                  {uncertainCells.map((c) => (
                    <li key={`${c.program}-${c.initiative}-${c.objective}`} className="border-b border-line py-2 text-sm last:border-0">
                      البرنامج {toArabicDigits(c.program)}، المبادرة {toArabicDigits(c.initiative)}، الهدف {toArabicDigits(c.objective)}
                      <span className="t-caption ms-2">صفحة {toArabicDigits(c.sourcePage)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel>
              <PanelHeader title="أعمدة الأهداف الإستراتيجية" />
              <ObjectiveLegend objectives={objectives} className="px-6 pb-6" />
            </Panel>
          </div>
        </div>

        <Panel className="mt-6 print:break-inside-avoid">
          <PanelHeader title="ملاحظات الاستخراج" description="معالجات متفق عليها لحالات خاصة في المصدر" />
          <ul className="flex flex-col gap-3 px-6 pb-6 text-sm">
            {merged.map((m) => (
              <li key={`m-${m.program}-${m.number}`} className="t-body text-sm">
                <span className="font-semibold text-ink">
                  البرنامج {toArabicDigits(m.program)}، المبادرة {toArabicDigits(m.number)}:
                </span>{" "}
                {m.sourceNote}
              </li>
            ))}
            {TAXONOMY_SOURCE.programs
              .filter((p) => p.numberingNote || p.officialName)
              .map((p) => (
                <li key={`p-${p.number}`} className="t-body text-sm">
                  <span className="font-semibold text-ink">البرنامج {toArabicDigits(p.number)}:</span>{" "}
                  {p.officialName ? `يُعرض باسم «${p.name}»، ويُحفظ الاسم الوارد في الوثيقة «${p.officialName}». ` : null}
                  {p.numberingNote}
                </li>
              ))}
            <li className="t-body text-sm">
              <span className="font-semibold text-ink">تصحيح أخطاء المسافات ({formatNumber(fixes.length)}):</span> صُحّحت أخطاء مسافات واضحة في
              أسماء المبادرات، ويظهر النص الأصلي تحت الاسم في الجداول أدناه.
            </li>
          </ul>
        </Panel>

        {changed.length > 0 ? (
          <Alert tone="warning" icon={<TriangleAlert strokeWidth={1.75} />} title="بيانات تختلف عن الاستخراج" className="mt-6">
            {formatNumber(changed.length)} مبادرة يختلف اسمها أو روابطها في قاعدة البيانات عما استُخرج من المصدر، وهي معلَّمة في الجداول.
          </Alert>
        ) : null}

        {programs.length === 0 ? (
          <EmptyState className="mt-6" title="لا توجد برامج محمّلة بعد" description="شغّل أمر تهيئة قاعدة البيانات لتحميل البرامج والمبادرات." />
        ) : (
          programs.map((p, index) => (
            <Panel key={p.id} className={cn("mt-6", index > 0 && "print:break-before-page")} aria-labelledby={`program-${p.number}`}>
              <PanelHeader
                title={
                  <span id={`program-${p.number}`}>
                    {toArabicDigits(p.number)}. {p.name}
                  </span>
                }
                description={`المبادرات: ${formatNumber(p.initiatives.length)} · الأهداف: ${formatNumber(p.goals.length)} · الجدول في صفحة المصدر ${
                  p.sourcePage ? toArabicDigits(p.sourcePage) : "—"
                }`}
              />
              <div className="overflow-x-auto pb-4">
                <table className="t-table w-full min-w-[50rem] border-collapse">
                  <caption className="sr-only">مبادرات {p.name} وارتباطها بالأهداف الإستراتيجية</caption>
                  <thead className="bg-surface-muted">
                    <tr>
                      <th scope="col" className="t-label w-14 py-2.5 ps-6 text-start">
                        الرقم
                      </th>
                      <th scope="col" className="t-label py-2.5 text-start">
                        المبادرة
                      </th>
                      <ObjectiveHeaderCells objectives={objectives} />
                      <th scope="col" className="t-label w-20 py-2.5 pe-6 text-center">
                        الصفحة
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.initiatives.map((i) => (
                      <tr key={i.id} className={cn("border-b border-line last:border-0 print:break-inside-avoid", i.differsFromSource && "bg-st-warn-soft")}>
                        <td className="py-2 ps-6 align-top font-semibold text-ink-subtle">{toArabicDigits(i.number)}</td>
                        <td className="py-2 pe-4 align-top">
                          {i.name}
                          {i.source?.sourceText ? <span className="t-caption block">في المصدر: {i.source.sourceText}</span> : null}
                          {i.source?.mergedRows ? <span className="t-caption block">في المصدر صفّان: {i.source.mergedRows.join(" · ")}</span> : null}
                          {i.differsFromSource ? (
                            <span className="mt-1 block">
                              <StatusText tone="warn" className="text-xs">
                                يختلف عن الاستخراج
                              </StatusText>
                            </span>
                          ) : null}
                        </td>
                        <ObjectiveCells linked={i.objectives} uncertain={i.source?.uncertainObjectives} />
                        <td className="pe-6 text-center align-top text-ink-muted">{i.source ? toArabicDigits(i.source.sourcePage) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {p.numberingNote ? <p className="t-caption px-6 pb-5">{p.numberingNote}</p> : null}
            </Panel>
          ))
        )}
      </PageBody>
    </>
  );
}
