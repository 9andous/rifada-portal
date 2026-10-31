import { CalendarDays, Check, CircleCheck, FileQuestion, Hourglass, Info, ListChecks, MessagesSquare, Paperclip, PenLine, Printer, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { DiscardDraftButton } from "@/components/requests/request-actions";
import { RequestStepper } from "@/components/requests/request-stepper";
import { StatusTimeline } from "@/components/requests/timeline";
import { MarkRequestSeen } from "@/components/requests/mark-request-seen";
import { buttonClasses } from "@/components/ui/button";
import { RefNumber } from "@/components/ui/ref-number";
import { Alert, Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { statusHelp } from "@/lib/association-status";
import { cn } from "@/lib/cn";
import { formatGregorian, formatHijri, formatNumber, toArabicDigits } from "@/lib/format";
import { acceptAttribute } from "@/lib/uploads";
import { workingDaysBetween } from "@/lib/working-days";
import type { RequestDetail } from "@/server/services/requests/read";
import { FileRow } from "./files";
import { AssociationMessages } from "./messages";
import { BackLink, NextStep } from "./parts";

const DAYS = (n: number) => (n === 1 ? "يوم عمل واحد" : n === 2 ? "يوما عمل" : n >= 3 && n <= 10 ? `${formatNumber(n)} أيام عمل` : `${formatNumber(n)} يوم عمل`);

/** The latest move into a status: its note (the supervisor's reason) and its date. */
function lastMove(r: RequestDetail, statusKey: string) {
  return r.timeline.filter((t) => t.to.key === statusKey).at(-1) ?? null;
}

/** How long the review may still take, while the request is with the unit. */
function reviewTime(r: RequestDetail, now: Date): string | null {
  if (!r.slaDueAt || r.decidedAt || statusHelp(r.status.key).turn !== "unit") return null;
  if (r.slaDueAt > now) {
    const left = workingDaysBetween(now, r.slaDueAt);
    return left === 0 ? "تنتهي اليوم" : `يتبقى ${DAYS(left)}`;
  }
  return "تجاوزت المدة المحددة";
}

function Pair({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-sm font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-1 text-base leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

const empty = <span className="text-ink-subtle">لم يُكتب بعد</span>;

function dateValue(d: Date | null) {
  if (!d) return empty;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      {formatHijri(d)} <span className="text-sm text-ink-muted">{formatGregorian(d)}</span>
    </span>
  );
}

function fieldValue(type: string | null, value: string | null): ReactNode {
  if (!value?.trim()) return empty;
  if (type === "DATE" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dateValue(new Date(`${value}T12:00:00Z`));
  return <span className="whitespace-pre-line">{toArabicDigits(value)}</span>;
}

/** A labelled note inside the status panel: the supervisor's notes or the decision's. */
function Note({ title, date, tone, children }: { title: string; date?: Date | null; tone: "warn" | "ok" | "bad"; children: ReactNode }) {
  const rule = tone === "warn" ? "border-st-warn bg-st-warn-soft" : tone === "ok" ? "border-st-ok bg-st-ok-soft" : "border-st-bad bg-st-bad-soft";
  return (
    <div className={cn("mt-4 rounded-lg border-s-4 px-4 py-3", rule)}>
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-bold text-ink">
        {title}
        {date ? <span className="font-normal text-ink-muted">{formatHijri(date)}</span> : null}
      </p>
      <p className="mt-1 whitespace-pre-line text-base leading-relaxed text-ink">{children}</p>
    </div>
  );
}

/**
 * The association officer's request page (D-102), in the same structure as the staff page: the
 * stages and key facts under the head; a «حالة الطلب» panel that says in words what the status
 * means, shows the supervisor's or the decision's notes and what is required; then the messages,
 * the data and the files; the actions and the history at the side.
 */
export function AssociationRequestView({
  request: r,
  uploads,
  slaDays,
  justSubmitted,
  now = new Date(),
}: {
  request: RequestDetail;
  uploads: { maxMb: number; allowedGroups: string[] };
  /** The review period in working days (settings), counted again from each submission. */
  slaDays: number;
  justSubmitted?: boolean;
  now?: Date;
}) {
  const help = statusHelp(r.status.key);
  const caps = r.capabilities;
  const submitted = r.referenceNo !== null;
  const returned = r.status.key === "RETURNED" ? lastMove(r, "RETURNED") : null;
  const decision = help.turn === "none" ? lastMove(r, r.status.key) : null;
  const missing = help.turn === "association" && r.completeness && !r.completeness.passed ? r.completeness.missing : [];
  const timing = reviewTime(r, now);
  const fields = r.requirements.filter((x) => x.kind === "FIELD");
  const attachments = r.requirements.filter((x) => x.kind === "ATTACHMENT");
  const editHref = `/association/requests/${r.id}/edit`;
  const editLabel = r.status.key === "RETURNED" ? "تعديل الطلب وإعادة إرساله" : "إكمال الطلب وإرساله";

  const facts: { label: string; value: ReactNode; icon: ReactNode }[] = [
    { label: "تاريخ الإرسال", value: r.submittedAt ? formatHijri(r.submittedAt) : "لم يُرسل بعد", icon: <CalendarDays strokeWidth={1.75} /> },
    { label: "آخر تحديث", value: formatHijri(r.updatedAt), icon: <RefreshCw strokeWidth={1.75} /> },
    { label: "الخطوة التالية", value: <NextStep statusKey={r.status.key} />, icon: <ListChecks strokeWidth={1.75} /> },
    r.decidedAt
      ? { label: "تاريخ القرار", value: formatHijri(r.decidedAt), icon: <CircleCheck strokeWidth={1.75} /> }
      : {
          label: "مدة المراجعة",
          value: timing ?? `${DAYS(slaDays)} بعد ${r.status.key === "RETURNED" ? "إعادة الإرسال" : "الإرسال"}`,
          icon: <Hourglass strokeWidth={1.75} />,
        },
  ];

  return (
    <>
      <PageBand
        compact
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <Link href="/association/requests" className="hover:underline">
              طلباتي
            </Link>
            <span aria-hidden="true">/</span>
            {r.referenceNo ? <RefNumber value={r.referenceNo} /> : <span>مسودة</span>}
          </span>
        }
        title={r.title || "طلب بلا عنوان"}
        lead={[r.track?.name, r.requestType?.name].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <StatusText tone={r.status.tone} className="px-3 py-1.5 text-base">
              {r.status.name}
            </StatusText>
            <BackLink href="/association/requests" label="العودة إلى طلباتي" />
          </>
        }
        figures={
          <Panel className="overflow-hidden">
            <div className="px-4 pb-6 pt-6 sm:px-8">
              <RequestStepper statusKey={r.status.key} />
            </div>
            {/* Four in a row only when each has room for a date on one line at the chosen text size
                (a container query in rem); hairlines between them come from the 1px gaps. */}
            <div className="@container border-t border-line">
              <dl className="grid grid-cols-1 gap-px bg-line @xl:grid-cols-2 @min-[66rem]:grid-cols-4">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-start gap-3 bg-surface px-6 py-4">
                    <span aria-hidden="true" className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-muted [&_svg]:size-[18px]">
                      {f.icon}
                    </span>
                    <span className="min-w-0">
                      <dt className="text-sm text-ink-muted">{f.label}</dt>
                      <dd className="mt-0.5 text-base font-semibold text-ink">{f.value}</dd>
                    </span>
                  </div>
                ))}
              </dl>
            </div>
          </Panel>
        }
      />
      <PageBody>
        <MarkRequestSeen requestId={r.id} />
        {/* On paper the page head is hidden; the request is named here instead. */}
        <div className="mb-4 hidden print:block">
          <p>{r.referenceNo ? <RefNumber value={r.referenceNo} /> : "مسودة"} · {r.status.name}</p>
          <h1 className="text-2xl font-bold">{r.title || "طلب بلا عنوان"}</h1>
          <p>{[r.track?.name, r.requestType?.name].filter(Boolean).join(" · ")}</p>
        </div>

        {justSubmitted && r.referenceNo ? (
          <Alert tone="success" title="تم إرسال طلبكم بنجاح" icon={<CircleCheck strokeWidth={1.75} />} className="mb-5 text-base">
            رقم الطلب <RefNumber value={r.referenceNo} className="font-bold" />. احتفظوا به للرجوع إليه؛ وتجدون حالة الطلب وملاحظات المشرف في هذه الصفحة.
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <Panel>
              <PanelHeader icon={<Info strokeWidth={1.75} />} title="حالة الطلب" description={r.status.name} />
              <div className="px-6 pb-6">
                <p className="text-base leading-relaxed text-ink">{help.meaning}</p>
                {returned ? (
                  <Note title="ملاحظات المشرف" date={returned.createdAt} tone="warn">
                    {returned.note ?? "لم يكتب المشرف ملاحظة. راسلوه من قسم الرسائل للاستفسار."}
                  </Note>
                ) : null}
                {decision?.note ? (
                  <Note title={r.status.key === "REJECTED" ? "سبب القرار" : "ملاحظة القرار"} date={decision.createdAt} tone={r.status.key === "REJECTED" ? "bad" : "ok"}>
                    {decision.note}
                  </Note>
                ) : null}
                {missing.length ? (
                  <div className="mt-4 rounded-lg border-s-4 border-st-bad bg-st-bad-soft px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-bold text-ink">
                      <TriangleAlert aria-hidden="true" strokeWidth={1.75} className="size-4 text-st-bad" />
                      لم يُرسل الطلب لأن هذه الأمور ناقصة:
                    </p>
                    <ul className="mt-1 flex list-disc flex-col gap-0.5 ps-5 text-base text-ink">
                      {missing.map((m, i) => (
                        <li key={`${m.field}-${i}`}>{m.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {help.action && caps.canEdit ? (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-st-warn/40 bg-surface-muted px-4 py-3.5">
                    <p className="text-base text-ink">
                      <span className="font-bold">المطلوب منكم: </span>
                      {help.action}
                    </p>
                    <Link href={editHref} className={buttonClasses("gold")}>
                      <PenLine aria-hidden="true" strokeWidth={1.75} />
                      {editLabel}
                    </Link>
                  </div>
                ) : help.turn === "unit" ? (
                  <p className="mt-4 text-base text-ink-muted">لا يلزمكم إجراء الآن؛ ستظهر نتيجة المراجعة في هذه الصفحة.</p>
                ) : null}
              </div>
            </Panel>

            {submitted ? (
              <Panel id="messages" className="scroll-mt-28 lg:scroll-mt-44">
                <PanelHeader icon={<MessagesSquare strokeWidth={1.75} />} title="الرسائل مع الوحدة الإشرافية" description="للاستفسار عن هذا الطلب أو الرد على ملاحظات المشرف." />
                <div className="px-6 pb-6">
                  <AssociationMessages
                    requestId={r.id}
                    comments={r.comments}
                    canComment={caps.canComment}
                    canAttach={caps.canUploadToComment}
                    accept={acceptAttribute(uploads.allowedGroups)}
                    maxMb={uploads.maxMb}
                  />
                </div>
              </Panel>
            ) : null}

            <Panel>
              <PanelHeader icon={<ListChecks strokeWidth={1.75} />} title="بيانات الطلب" />
              <dl className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 pb-6 sm:grid-cols-2">
                <Pair label="المسار المستهدف">{r.track?.name ?? empty}</Pair>
                <Pair label="نوع الطلب">{r.requestType?.name ?? empty}</Pair>
                <Pair label="وصف المشروع" wide>
                  {r.description ? <span className="whitespace-pre-line">{r.description}</span> : empty}
                </Pair>
                <Pair label="الأهداف والمخرجات المتوقعة" wide>
                  {r.goals ? <span className="whitespace-pre-line">{r.goals}</span> : empty}
                </Pair>
                {r.targetAudience ? <Pair label="الفئة المستهدفة">{r.targetAudience}</Pair> : null}
                {r.location ? <Pair label="مكان التنفيذ">{r.location}</Pair> : null}
                <Pair label="الفئات المستهدفة" wide>{r.expectedBeneficiaries ? <span className="whitespace-pre-line">{r.expectedBeneficiaries}</span> : empty}</Pair>
                <Pair label="الميزانية التقديرية">{r.estimatedBudget !== null ? `${formatNumber(r.estimatedBudget)} ر.س` : empty}</Pair>
                <Pair label="تاريخ البداية">{dateValue(r.startDate)}</Pair>
                <Pair label="تاريخ النهاية">{dateValue(r.endDate)}</Pair>
                <Pair label="مؤشرات القياس" wide>
                  {r.kpis ? <span className="whitespace-pre-line">{r.kpis}</span> : empty}
                </Pair>
                <Pair label="الشركاء" wide>
                  {r.partners || empty}
                </Pair>
                {fields.map((f) => (
                  <Pair key={f.key} label={f.label} wide={f.fieldType === "TEXTAREA"}>
                    {fieldValue(f.fieldType, f.value)}
                  </Pair>
                ))}
              </dl>
            </Panel>

            <Panel>
              <PanelHeader
                icon={<Paperclip strokeWidth={1.75} />}
                title="الملفات المرفقة"
                description={attachments.length ? `${formatNumber(attachments.filter((a) => a.files.length).length)} من ${formatNumber(attachments.length)} مرفقة` : undefined}
              />
              <div className="px-6 pb-6">
                {attachments.length === 0 && r.otherFiles.length === 0 ? (
                  <p className="text-base text-ink-muted">لم تُرفق ملفات.</p>
                ) : (
                  <div className="flex flex-col gap-5">
                    {attachments.map((a) => (
                      <div key={a.key}>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-bold text-ink">
                          {a.label}
                          {a.isRequired ? null : <span className="text-sm font-normal text-ink-muted">(اختياري)</span>}
                          {a.files.length ? (
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-st-ok">
                              <Check aria-hidden="true" strokeWidth={2.5} className="size-4" />
                              مرفق
                            </span>
                          ) : a.isRequired ? (
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-st-warn">
                              <FileQuestion aria-hidden="true" strokeWidth={1.75} className="size-4" />
                              لم يُرفق بعد
                            </span>
                          ) : null}
                        </p>
                        {a.files.length ? (
                          <ul className="mt-2 flex flex-col gap-2">
                            {a.files.map((f) => (
                              <FileRow key={f.attachmentId} requestId={r.id} file={f} />
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                    {r.otherFiles.length ? (
                      <div>
                        <p className="text-base font-bold text-ink">ملفات إضافية من الجمعية</p>
                        <ul className="mt-2 flex flex-col gap-2">
                          {r.otherFiles.map((f) => (
                            <FileRow key={f.attachmentId} requestId={r.id} file={f} />
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-[168px]" data-print="hide">
            <Panel>
              <PanelHeader title="الإجراءات" />
              <div className="flex flex-col gap-2.5 px-6 pb-6">
                {caps.canEdit ? (
                  <Link href={editHref} className={buttonClasses("gold", "lg", "w-full")}>
                    <PenLine aria-hidden="true" strokeWidth={1.75} />
                    {editLabel}
                  </Link>
                ) : null}
                {submitted && caps.canComment ? (
                  <Link href="#messages" className={buttonClasses("outline", "lg", "w-full")}>
                    <MessagesSquare aria-hidden="true" strokeWidth={1.75} />
                    مراسلة الوحدة الإشرافية
                  </Link>
                ) : null}
                {caps.canPrint ? (
                  <Link href={`/account/requests/${r.id}/print`} className={buttonClasses("outline", "lg", "w-full")}>
                    <Printer aria-hidden="true" strokeWidth={1.75} />
                    طباعة الطلب (PDF)
                  </Link>
                ) : submitted ? (
                  <p className="flex items-start gap-2 rounded-md bg-surface-muted px-3 py-2.5 text-sm text-ink-muted">
                    <Printer aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                    تتاح طباعة الطلب بعد اعتماده من الوحدة الإشرافية.
                  </p>
                ) : null}
                {caps.canDiscard ? (
                  <div className="mt-2 border-t border-line pt-3">
                    <DiscardDraftButton requestId={r.id} title={r.title} />
                  </div>
                ) : null}
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="سجل الطلب" description="ما جرى على الطلب، الأحدث أولًا." />
              <div className="px-6 pb-6">
                <StatusTimeline entries={r.timeline} />
              </div>
            </Panel>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
