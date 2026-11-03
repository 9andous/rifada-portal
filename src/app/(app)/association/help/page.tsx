import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ALargeSmall, FilePlus2, FileUp, KeyRound, ListChecks, MessagesSquare, PenLine, type LucideIcon } from "lucide-react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { buttonClasses } from "@/components/ui/button";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { statusHelp, TURN_LABEL } from "@/lib/association-status";
import { arabicList, daysPhrase, formatNumber } from "@/lib/format";
import { UPLOAD_GROUP_LABELS, type UploadGroup } from "@/lib/validation/settings";
import { statusTone } from "@/lib/workflow";
import { db } from "@/server/db";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "المساعدة" };

const TOPICS: { id: string; title: string; icon: LucideIcon }[] = [
  { id: "new", title: "كيف أقدّم طلبًا جديدًا؟", icon: FilePlus2 },
  { id: "status", title: "ماذا تعني حالة طلبي؟", icon: ListChecks },
  { id: "returned", title: "أعاد المشرف طلبي للتعديل", icon: PenLine },
  { id: "files", title: "كيف أرفق ملفًا؟", icon: FileUp },
  { id: "messages", title: "كيف أراسل المشرف؟", icon: MessagesSquare },
  { id: "text-size", title: "كيف أكبّر الخط؟", icon: ALargeSmall },
  { id: "password", title: "كلمة المرور", icon: KeyRound },
];

/** Numbered steps. */
function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="t-figure flex size-8 shrink-0 items-center justify-center rounded-full bg-band text-sm text-band-gold">{formatNumber(i + 1)}</span>
          <span className="pt-0.5 text-base leading-relaxed text-ink">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-lg border-s-4 border-accent bg-accent-soft/60 px-4 py-3 text-[0.9375rem] leading-relaxed text-ink">{children}</p>;
}

function Topic({ id, title, icon: Icon, children }: { id: string; title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Panel id={id} className="scroll-mt-28 lg:scroll-mt-44">
      <PanelHeader icon={<Icon strokeWidth={1.75} />} title={title} />
      <div className="px-6 pb-6">{children}</div>
    </Panel>
  );
}

const b = (text: string) => <strong className="font-bold">«{text}»</strong>;

/** A keyboard key, isolated left to right inside the Arabic sentence. */
function Key({ children }: { children: string }) {
  return (
    <kbd dir="ltr" className="mx-0.5 inline-block rounded-sm border border-line-strong bg-surface px-1.5 font-sans text-sm font-semibold text-ink shadow-1">
      {children}
    </kbd>
  );
}

/** «المساعدة» (D-102): short answers to what an association officer needs, as numbered steps. */
export default async function HelpPage() {
  const [maxMb, groups, slaDays, statuses] = await Promise.all([
    getSetting("uploads.maxFileMb"),
    getSetting("uploads.allowedGroups"),
    getSetting("sla.workingDays"),
    db.requestStatus.findMany({ where: { key: { notIn: ["SUBMITTED", "COMPLETENESS_CHECK"] } }, orderBy: { sortOrder: "asc" }, select: { key: true, name: true, colorToken: true } }),
  ]);
  const accepted = arabicList((groups as readonly UploadGroup[]).map((g) => UPLOAD_GROUP_LABELS[g]));

  return (
    <>
      <PageBand title="المساعدة" lead="شرح مختصر لكل ما تحتاجونه في المنصة، خطوة بخطوة. اختاروا سؤالكم من القائمة." />
      <PageBody>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <Panel className="lg:sticky lg:top-[168px]">
            <PanelHeader title="الأسئلة" />
            <nav aria-label="أسئلة المساعدة" className="px-3 pb-3">
              <ul className="flex flex-col gap-1">
                {TOPICS.map(({ id, title, icon: Icon }) => (
                  <li key={id}>
                    <a href={`#${id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-semibold text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink [&_svg]:size-[18px]">
                      <Icon aria-hidden="true" strokeWidth={1.75} className="shrink-0 text-primary" />
                      {title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </Panel>

          <div className="flex min-w-0 flex-col gap-5">
            <Topic id="new" title="كيف أقدّم طلبًا جديدًا؟" icon={FilePlus2}>
              <Steps
                items={[
                  <>اضغطوا الزر الذهبي {b("تقديم طلب جديد")} في أعلى الصفحة.</>,
                  <>اختاروا البرنامج، ثم المبادرة الأقرب إلى طلبكم، ثم اضغطوا {b("التالي")}.</>,
                  <>اكتبوا اسم المشروع ووصفه، ثم المستفيدين ومكان التنفيذ وتاريخيه، واضغطوا {b("التالي")} بعد كل خطوة.</>,
                  <>في خطوة {b("متطلبات المبادرة")} أكملوا ما تطلبه المبادرة من بيانات وملفات، إن وُجدت.</>,
                  <>في الخطوة الأخيرة راجعوا ما كتبتم، ثم اضغطوا {b("إرسال الطلب")}.</>,
                ]}
              />
              <Note>يُحفظ ما تكتبونه عند الانتقال بين الخطوات، فيمكنكم الخروج متى شئتم ثم إكمال الطلب لاحقًا من صفحة «طلباتي».</Note>
              <Link href="/association/requests/new" className={buttonClasses("gold", "md", "mt-4")}>
                <FilePlus2 aria-hidden="true" strokeWidth={1.75} />
                تقديم طلب جديد
              </Link>
            </Topic>

            <Topic id="status" title="ماذا تعني حالة طلبي؟" icon={ListChecks}>
              <p className="mb-4 text-base text-ink-muted">تظهر الحالة على كل طلب في «طلباتي» وفي صفحة الطلب. المدة المحددة لمراجعة الطلب بعد إرساله {daysPhrase(slaDays)} عمل.</p>
              <dl className="flex flex-col">
                {statuses.map((s) => {
                  const help = statusHelp(s.key);
                  return (
                    <div key={s.key} className="grid grid-cols-1 gap-2 border-b border-line py-3 last:border-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
                      <dt>
                        <StatusText tone={statusTone(s.colorToken)}>{s.name}</StatusText>
                      </dt>
                      <dd className="text-base leading-relaxed text-ink">
                        {help.meaning}
                        {help.turn !== "none" ? (
                          <span className="mt-0.5 block text-sm text-ink-muted">
                            الخطوة التالية: {help.next} ({TURN_LABEL[help.turn]}).
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Topic>

            <Topic id="returned" title="أعاد المشرف طلبي للتعديل، ماذا أفعل؟" icon={PenLine}>
              <Steps
                items={[
                  <>تجدون الطلب في أعلى الصفحة الرئيسية، أو في {b("طلباتي")} تحت {b("معاد للتعديل")}.</>,
                  <>افتحوا الطلب، واقرؤوا {b("ملاحظات المشرف")}.</>,
                  <>اضغطوا {b("تعديل الطلب")}، وعدّلوا ما طلبه المشرف.</>,
                  <>في الخطوة الأخيرة اضغطوا {b("إعادة إرسال الطلب")}.</>,
                ]}
              />
              <Note>إن لم تتضح لكم ملاحظة المشرف، اسألوه في {b("الرسائل مع الوحدة الإشرافية")} في صفحة الطلب نفسه.</Note>
            </Topic>

            <Topic id="files" title="كيف أرفق ملفًا؟" icon={FileUp}>
              <Steps
                items={[
                  <>في خطوة {b("متطلبات المبادرة")} من كتابة الطلب، اضغطوا {b("اختيار ملف لإرفاقه")} تحت اسم الملف المطلوب.</>,
                  <>اختاروا الملف من جهازكم، وانتظروا حتى تظهر عبارة {b("تم الإرفاق")}.</>,
                  <>لتغيير ملف أرفقتموه، اضغطوا {b("استبدال بنسخة أحدث")} بجواره.</>,
                ]}
              />
              <Note>
                الملفات المقبولة: {accepted}، حتى {formatNumber(maxMb)} ميغابايت للملف. وإن طُلب منكم نموذج معيّن فستجدونه في صفحة{" "}
                <Link href="/association/documents" className="font-bold text-primary underline">
                  الأدلة والنماذج
                </Link>
                : نزّلوه واملؤوه، ثم أرفقوه.
              </Note>
            </Topic>

            <Topic id="messages" title="كيف أراسل المشرف؟" icon={MessagesSquare}>
              <Steps
                items={[
                  <>افتحوا صفحة الطلب من {b("طلباتي")}.</>,
                  <>انزلوا إلى قسم {b("الرسائل مع الوحدة الإشرافية")}، أو اضغطوا {b("مراسلة الوحدة الإشرافية")} في الإجراءات.</>,
                  <>اكتبوا رسالتكم، ثم اضغطوا {b("إرسال الرسالة")}. ويمكنكم إرفاق ملف معها.</>,
                ]}
              />
              <Note>تتاح الرسائل بعد إرسال الطلب، وتظهر ردود الوحدة الإشرافية في القسم نفسه.</Note>
            </Topic>

            <Topic id="text-size" title="الخط صغير، كيف أكبّره؟" icon={ALargeSmall}>
              <Steps
                items={[
                  <>في أعلى الصفحة ثلاثة أزرار عليها الحرف {b("أ")} بأحجام مختلفة. اضغطوا الحرف الأكبر لتكبير الخط، والأصغر لتصغيره.</>,
                  <>على الهاتف تجدون الأزرار نفسها في القائمة التي تفتح من زر القائمة في أعلى الصفحة.</>,
                  <>يبقى الحجم الذي تختارونه محفوظًا على هذا الجهاز.</>,
                ]}
              />
              <Note>
                ويمكنكم أيضًا تكبير الصفحة كلها في الحاسب بالضغط على المفتاحين <Key>Ctrl</Key> و<Key>+</Key> معًا، وتصغيرها بالمفتاحين <Key>Ctrl</Key> و<Key>−</Key>.
              </Note>
            </Topic>

            <Topic id="password" title="كلمة المرور" icon={KeyRound}>
              <Steps
                items={[
                  <>لتغيير كلمة المرور: افتحوا {b("ملف الجمعية")} ثم اضغطوا {b("تغيير كلمة المرور")}.</>,
                  <>إن نسيتموها: اضغطوا {b("نسيت كلمة المرور؟")} في صفحة الدخول، واتبعوا الخطوات.</>,
                ]}
              />
              <Link href="/account/change-password" className={buttonClasses("outline", "md", "mt-4")}>
                <KeyRound aria-hidden="true" strokeWidth={1.75} />
                تغيير كلمة المرور
              </Link>
            </Topic>
          </div>
        </div>
      </PageBody>
    </>
  );
}
