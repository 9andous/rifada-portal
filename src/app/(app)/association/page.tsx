import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleHelp, Eye, FilePen, FilePlus2, Hourglass, ListChecks, PenLine, Send, Undo2 } from "lucide-react";
import { AssocRequestsTable } from "@/components/association/parts";
import { BandDate } from "@/components/dashboard/band-date";
import { DismissNotice } from "@/components/association/dismiss-notice";
import { KpiRow } from "@/components/dashboard/kpis";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Panel, PanelHeader } from "@/components/ui/surface";
import { daysPhrase, formatHijri, formatNumber, greeting } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getAssociationHome } from "@/server/services/association-home";
import { getOverview } from "@/server/services/dashboard";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "الرئيسية" };

const LIST = "/association/requests";

/** The association officer's home (D-102): their figures, what waits on them, their latest requests and how a request moves. */
export default async function AssociationHome() {
  const user = await requireUser();
  const now = new Date();
  const [overview, home, slaDays] = await Promise.all([getOverview(user, now), getAssociationHome(user, now), getSetting("sla.workingDays")]);
  const draft = home.drafts[0];

  const journey = [
    { title: "كتابة الطلب وإرساله", text: "تكتبون البيانات وترفقون الملفات خطوة بخطوة، ثم ترسلون الطلب." },
    { title: "التحقق من الاكتمال", text: "يتحقق النظام فورًا من اكتمال البيانات والملفات المطلوبة." },
    { title: "مراجعة المشرف المختص", text: `يراجع المشرف الطلب خلال ${daysPhrase(slaDays)} عمل، وقد يراسلكم.` },
    { title: "القرار", text: "اعتماد الطلب، أو إعادته إليكم للتعديل، أو عدم اعتماده، مع السبب." },
  ];

  return (
    <>
      <PageBand
        eyebrow={`${greeting(now)}، ${user.name}`}
        title={user.associationName ?? "حساب الجمعية"}
        lead="متابعة طلبات جمعيتكم لدى الوحدة الإشرافية،"
        actions={
          <>
            <BandDate date={now} />
            <Link href={`${LIST}/new`} className={buttonClasses("gold", "lg")}>
              <FilePlus2 aria-hidden="true" strokeWidth={1.75} />
              تقديم طلب جديد
            </Link>
          </>
        }
        figures={
          // Recent acceptances (green) and requests sent back for changes (red) lead the page, above
          // the figures (owner's request).
          <div className="flex flex-col gap-5">
            {home.approved.map((r) => (
              <Alert
                key={r.id}
                tone="success"
                icon={<CircleCheck strokeWidth={1.75} />}
                title={`قُبل طلبكم «${r.title || "طلب بلا عنوان"}»`}
                className="text-base"
                action={
                  <>
                    <Link href={`${LIST}/${r.id}`} className={buttonClasses("outline")}>
                      <Eye aria-hidden="true" strokeWidth={1.75} />
                      عرض الطلب
                    </Link>
                    <DismissNotice notificationId={r.notificationId} />
                  </>
                }
              >
                {r.note ? (
                  <span className="mt-1 block whitespace-pre-line text-ink">
                    <span className="font-bold">ملاحظات المشرف: </span>
                    {r.note}
                  </span>
                ) : (
                  <span className="mt-1 block">وافقت الوحدة الإشرافية على طلبكم.</span>
                )}
                <span className="mt-1 block text-sm">قُبل في {formatHijri(r.approvedAt)}</span>
              </Alert>
            ))}
            {home.returned.map((r) => (
              <Alert
                key={r.id}
                tone="danger"
                icon={<Undo2 strokeWidth={1.75} />}
                title={`أعاد المشرف طلبكم «${r.title || "طلب بلا عنوان"}» إليكم للتعديل`}
                className="text-base"
                action={
                  <>
                    <Link href={`${LIST}/${r.id}`} className={buttonClasses("outline")}>
                      <Eye aria-hidden="true" strokeWidth={1.75} />
                      عرض الطلب
                    </Link>
                    <Link href={`${LIST}/${r.id}/edit`} className={buttonClasses("gold")}>
                      <PenLine aria-hidden="true" strokeWidth={1.75} />
                      تعديل الطلب
                    </Link>
                  </>
                }
              >
                {r.note ? (
                  <span className="mt-1 block whitespace-pre-line text-ink">
                    <span className="font-bold">ملاحظات المشرف: </span>
                    {r.note}
                  </span>
                ) : (
                  <span className="mt-1 block">اطّلعوا على الطلب وعدّلوه، ثم أعيدوا إرساله.</span>
                )}
                {r.returnedAt ? <span className="mt-1 block text-sm">أُعيد في {formatHijri(r.returnedAt)}</span> : null}
              </Alert>
            ))}
            <KpiRow
              wrap
              items={[
                {
                  label: "الطلبات المرسلة",
                  icon: Send,
                  featured: true,
                  value: formatNumber(overview.total),
                  caption: overview.drafts ? `ومسودات لم تُرسل: ${formatNumber(overview.drafts)}` : "منذ تسجيل الجمعية",
                  href: LIST,
                },
                { label: "قيد المراجعة", icon: Hourglass, tone: "review", value: formatNumber(overview.underReview), caption: "لدى الوحدة الإشرافية", href: `${LIST}?status=UNDER_REVIEW` },
                {
                  label: "معادة للتعديل",
                  icon: Undo2,
                  tone: "warn",
                  alert: overview.returned > 0,
                  value: formatNumber(overview.returned),
                  caption: overview.returned ? "بانتظار تعديلكم" : "لا شيء بانتظار تعديلكم",
                  href: `${LIST}?status=RETURNED`,
                },
                {
                  label: "مقبولة",
                  icon: CircleCheck,
                  tone: "ok",
                  value: formatNumber(overview.approved),
                  caption: overview.rejected ? `وغير معتمدة: ${formatNumber(overview.rejected)}` : "طلبات صدر اعتمادها",
                  href: `${LIST}?status=APPROVED`,
                },
              ]}
            />
          </div>
        }
      />
      <PageBody className="flex flex-col gap-5">
        {draft ? (
          <Alert
            tone="danger"
            icon={<FilePen strokeWidth={1.75} />}
            title={home.drafts.length === 1 ? "لديكم طلب لم يُرسل بعد (مسودة)" : `لديكم ${formatNumber(home.drafts.length)} طلبات لم تُرسل بعد (مسودات)`}
            className="text-base"
            action={
              home.drafts.length === 1 ? (
                <Link href={`${LIST}/${draft.id}/edit`} className={buttonClasses("gold")}>
                  <PenLine aria-hidden="true" strokeWidth={1.75} />
                  إكمال الطلب
                </Link>
              ) : (
                <Link href={`${LIST}?status=DRAFT`} className={buttonClasses("outline")}>
                  عرض المسودات
                </Link>
              )
            }
          >
            <span className="mt-1 block">
              {home.drafts.length === 1 ? `«${draft.title || "طلب بلا عنوان"}»، آخر حفظ في ${formatHijri(draft.updatedAt)}. ` : null}
              لا تصل المسودة إلى الوحدة الإشرافية حتى تُرسلوها.
            </span>
          </Alert>
        ) : null}

        <Panel>
          <PanelHeader
            icon={<ListChecks strokeWidth={1.75} />}
            title="آخر طلبات الجمعية"
            description="حالة كل طلب، والخطوة التالية فيه، ومن عليه أن يقوم بها."
            actions={
              home.latest.length ? (
                <Link href={LIST} className={buttonClasses("outline", "sm")}>
                  جميع الطلبات
                </Link>
              ) : null
            }
          />
          {home.latest.length ? (
            <AssocRequestsTable rows={home.latest} caption="آخر طلبات الجمعية" />
          ) : (
            <EmptyState
              variant="inline"
              icon={<FilePlus2 strokeWidth={1.75} />}
              title="لم تقدّموا أي طلب بعد"
              description="ابدؤوا بتقديم طلب لبرنامج أو مشروع ضمن برامج الرئاسة، وستظهر هنا حالته وخطواته."
              action={
                <Link href={`${LIST}/new`} className={buttonClasses("gold", "lg")}>
                  <FilePlus2 aria-hidden="true" strokeWidth={1.75} />
                  تقديم طلب جديد
                </Link>
              }
            />
          )}
        </Panel>

        <Panel>
          <PanelHeader
            icon={<CircleHelp strokeWidth={1.75} />}
            title="كيف يسير الطلب؟"
            description="المراحل التي يمر بها كل طلب في المنصة."
            actions={
              <Link href="/association/help" className={buttonClasses("outline", "sm")}>
                دليل الاستخدام
              </Link>
            }
          />
          <ol className="grid grid-cols-1 gap-5 px-6 pb-6 sm:grid-cols-2 xl:grid-cols-4">
            {journey.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="t-figure flex size-9 shrink-0 items-center justify-center rounded-full bg-band text-base text-band-gold">{formatNumber(i + 1)}</span>
                <span>
                  <span className="block font-bold text-ink">{s.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-ink-muted">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </PageBody>
    </>
  );
}
