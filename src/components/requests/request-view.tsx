import { CalendarDays, CircleCheck, CircleDashed, ClipboardCheck, Clock, FileText, History, ListTree, MessagesSquare, Paperclip, PenLine, ScrollText, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { PersonName } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { RefNumber } from "@/components/ui/ref-number";
import { Alert, HeaderIcon, Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { DataTable, THead, Td, Th, Tr } from "@/components/ui/table";
import { auditActionLabel } from "@/lib/audit-labels";
import { acceptedGroups } from "@/lib/completeness";
import { arabicList, formatGregorian, formatHijri, formatNumber, toArabicDigits } from "@/lib/format";
import { acceptAttribute } from "@/lib/uploads";
import { UPLOAD_GROUP_LABELS } from "@/lib/validation/settings";
import { workingDaysBetween } from "@/lib/working-days";
import type { RequestDetail } from "@/server/services/requests/read";
import { Conversation } from "./conversation";
import { DecisionPanel } from "./decision-panel";
import { FileItem } from "./file-list";
import { DiscardDraftButton, ReassignButton } from "./request-actions";
import { RequestStepper } from "./request-stepper";
import { StatusTimeline } from "./timeline";

const DAY_UNIT = (n: number) => (n === 1 ? "يوم عمل واحد" : n === 2 ? "يوما عمل" : n >= 3 && n <= 10 ? `${formatNumber(n)} أيام عمل` : `${formatNumber(n)} يوم عمل`);

function slaText(r: RequestDetail, now: Date): string {
  if (!r.slaDueAt || !r.submittedAt) return "—";
  if (r.decidedAt) return "انتهت بالقرار";
  if (r.status.key === "RETURNED") return "متوقفة بانتظار تعديل الجمعية";
  if (r.slaDueAt > now) {
    const left = workingDaysBetween(now, r.slaDueAt);
    return left === 0 ? "تنتهي اليوم" : `يتبقى ${DAY_UNIT(left)}`;
  }
  return `متأخر ${DAY_UNIT(Math.max(1, workingDaysBetween(r.slaDueAt, now)))}`;
}

function Section({ title, aside, children, id, icon, flushBody }: { title: string; aside?: ReactNode; children: ReactNode; id?: string; icon: ReactNode; flushBody?: boolean }) {
  return (
    <Panel id={id} className="scroll-mt-40">
      <PanelHeader icon={icon} title={title} description={aside} />
      <div className={flushBody ? "-mt-5" : "px-6 pb-6"}>{children}</div>
    </Panel>
  );
}

function SideCard({ title, icon, actions, children, note }: { title: string; icon: ReactNode; actions?: ReactNode; children: ReactNode; note?: string }) {
  return (
    <Panel>
      <PanelHeader icon={icon} title={title} description={note} actions={actions} className="mb-4 py-3.5" />
      <div className="px-5 pb-5 sm:px-6">{children}</div>
    </Panel>
  );
}

function Info({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="t-label">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}

const dateOnly = (d: Date | null) => (d ? <DateDisplay date={d} /> : <span className="text-ink-subtle">—</span>);

/** A stored field value for display: dates Hijri first, digits Arabic-Indic. */
function fieldValue(type: string | null, value: string | null): ReactNode {
  if (!value?.trim()) return <span className="text-ink-subtle">—</span>;
  if (type === "DATE" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T12:00:00Z`);
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-2">
        {formatHijri(d)} <span className="text-xs text-ink-subtle">{formatGregorian(d)}</span>
      </span>
    );
  }
  return <span className="whitespace-pre-line">{toArabicDigits(value)}</span>;
}

export type RequestViewProps = {
  request: RequestDetail;
  /** Where «الطلبات» in the band leads back to. */
  listHref: string;
  listLabel: string;
  uploads: { maxMb: number; allowedGroups: string[] };
  /** The officer arrived right after submitting. */
  justSubmitted?: boolean;
  now?: Date;
};

/** The request page for every role (docs/DESIGN.md: Request detail). What it shows comes from the server, per role. */
export function RequestView({ request: r, listHref, listLabel, uploads, justSubmitted, now = new Date() }: RequestViewProps) {
  const caps = r.capabilities;
  const isStaff = r.assignment !== null;
  const fields = r.requirements.filter((x) => x.kind === "FIELD");
  const attachments = r.requirements.filter((x) => x.kind === "ATTACHMENT");
  const submitted = r.referenceNo !== null;
  const dialogRequest = { id: r.id, title: r.title, referenceNo: r.referenceNo };

  const facts: [string, ReactNode, ReactNode][] = [
    ["تاريخ التقديم", r.submittedAt ? formatHijri(r.submittedAt) : "لم يُقدَّم بعد", <CalendarDays key="i" strokeWidth={1.75} />],
    ["مهلة المراجعة", slaText(r, now), <Clock key="i" strokeWidth={1.75} />],
  ];
  if (isStaff) facts.push(["المشرف", r.assignment?.supervisor?.name ?? "لم يُسند بعد", <UserRound key="i" strokeWidth={1.75} />]);
  facts.push(["فحص الاكتمال", r.completeness ? (r.completeness.passed ? "مكتمل" : "غير مكتمل") : "لم يُجرَ بعد", <ClipboardCheck key="i" strokeWidth={1.75} />]);

  return (
    <>
      <PageBand
        compact
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={listHref} className="hover:underline">
              {listLabel}
            </Link>
            <span aria-hidden="true">/</span>
            {r.referenceNo ? <RefNumber value={r.referenceNo} /> : <span>مسودة</span>}
          </span>
        }
        title={r.title || "طلب بلا عنوان"}
        actions={
          <StatusText tone={r.status.tone} className="px-3 py-1 text-sm">
            {r.status.name}
          </StatusText>
        }
        lead={`${isStaff ? `${r.association.name} · ` : ""}${toArabicDigits(r.program.number)}. ${r.program.name}`}
        figures={
          <Panel>
            <div className="px-4 pb-6 pt-6 sm:px-8">
              <RequestStepper statusKey={r.status.key} />
            </div>
            <dl className={`grid grid-cols-1 border-t border-line sm:grid-cols-2 ${facts.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
              {facts.map(([k, v, icon], i) => (
                <div key={k} className={`flex items-center gap-3 px-6 py-4 ${i > 0 ? "border-t border-line sm:border-t-0 sm:border-s" : ""}`}>
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-muted [&_svg]:size-[18px]">
                    {icon}
                  </span>
                  <span className="min-w-0">
                    <dt className="text-xs text-ink-subtle">{k}</dt>
                    <dd className="mt-0.5 truncate text-sm font-semibold text-ink">{v}</dd>
                  </span>
                </div>
              ))}
            </dl>
          </Panel>
        }
      />
      <PageBody className={caps.canDecide ? "pb-28 lg:pb-10" : undefined}>
        <div className="flex flex-col gap-4">
          {justSubmitted && r.referenceNo ? (
            <Alert tone="success" title="قُدِّم الطلب بنجاح" icon={<CircleCheck strokeWidth={1.75} />}>
              رقم الطلب <RefNumber value={r.referenceNo} />. يمكنكم متابعة حالته ومراحل مراجعته من هذه الصفحة.
            </Alert>
          ) : null}
          {caps.returnedNotice ? <Alert tone="warning" title="قيد التعديل لدى الجمعية — قد يتغير محتوى الطلب قبل إعادة التقديم" /> : null}
          {!isStaff && r.status.key === "RETURNED" ? (
            <Alert tone="warning" title="أُعيد الطلب إليكم للتعديل">
              {r.timeline.filter((t) => t.to.key === "RETURNED").at(-1)?.note ?? "عدّلوا الطلب ثم أعيدوا تقديمه."}
            </Alert>
          ) : null}
          {!isStaff && r.status.key === "DRAFT" ? (
            <Alert tone="info" title="هذه مسودة لم تُقدَّم بعد">
              لا تطّلع الوحدة الإشرافية على المسودة حتى تقدّموها.
            </Alert>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <Section title="وصف الطلب" icon={<FileText strokeWidth={1.75} />}>
              {r.description ? <p className="t-body max-w-3xl whitespace-pre-line">{r.description}</p> : <p className="t-body text-ink-subtle">لم يُكتب وصف بعد.</p>}
              <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 rounded-lg border border-line bg-surface-muted p-5 sm:grid-cols-2">
                <Info label="المبادرة" wide>
                  {toArabicDigits(r.initiative.number)}. {r.initiative.name}
                </Info>
                {isStaff ? <Info label="الجمعية">{r.association.name}</Info> : null}
                <Info label="الفئة المستهدفة">{r.targetAudience || <span className="text-ink-subtle">—</span>}</Info>
                <Info label="مكان التنفيذ">{r.location || <span className="text-ink-subtle">—</span>}</Info>
                <Info label="تاريخ البداية">{dateOnly(r.startDate)}</Info>
                <Info label="تاريخ النهاية">{dateOnly(r.endDate)}</Info>
                <Info label="أنشأه">{r.createdBy}</Info>
              </dl>
            </Section>

            {fields.length || r.otherValues.length ? (
              <Section title="بيانات المبادرة" icon={<ListTree strokeWidth={1.75} />}>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                  {fields.map((f) => (
                    <Info key={f.key} label={f.label} wide={f.fieldType === "TEXTAREA"}>
                      {fieldValue(f.fieldType, f.value)}
                    </Info>
                  ))}
                  {r.otherValues.map((v) => (
                    <Info key={v.key} label={`بيانات أخرى (${v.key})`}>
                      {fieldValue(null, v.value)}
                    </Info>
                  ))}
                </dl>
              </Section>
            ) : null}

            <Section
              title="المتطلبات والمرفقات"
              icon={<Paperclip strokeWidth={1.75} />}
              flushBody={attachments.length > 0 || r.otherFiles.length > 0}
              aside={
                attachments.length
                  ? `${formatNumber(attachments.filter((a) => a.files.length > 0).length)} من ${formatNumber(attachments.length)} مرفقة`
                  : undefined
              }
            >
              {attachments.length === 0 && r.otherFiles.length === 0 ? (
                <p className="t-body text-sm">لا تتطلب هذه المبادرة مرفقات.</p>
              ) : (
                <div>
                  <DataTable caption="المتطلبات والمرفقات" minWidth="36rem">
                    <THead>
                      <Th className="w-56">المتطلب</Th>
                      <Th className="w-32">الحالة</Th>
                      <Th>الملفات والإصدارات</Th>
                    </THead>
                    <tbody>
                      {attachments.map((a) => (
                        <Tr key={a.key}>
                          <Td>
                            <span className="font-semibold text-ink">{a.label}</span>
                            <span className="t-caption block">
                              {a.isRequired ? "مطلوب" : "اختياري"} ·{" "}
                              {arabicList(acceptedGroups(a, uploads.allowedGroups).map((g) => UPLOAD_GROUP_LABELS[g]))}
                            </span>
                          </Td>
                          <Td>
                            {a.files.length ? (
                              <StatusText tone="ok">مرفق</StatusText>
                            ) : a.isRequired ? (
                              <StatusText tone="bad">غير مرفق</StatusText>
                            ) : (
                              <StatusText tone="neutral">لا يوجد</StatusText>
                            )}
                          </Td>
                          <Td>
                            {a.files.length ? (
                              <ul className="-my-2 flex flex-col">
                                {a.files.map((f) => (
                                  <FileItem key={f.attachmentId} requestId={r.id} file={f} />
                                ))}
                              </ul>
                            ) : (
                              <span className="text-ink-subtle">—</span>
                            )}
                          </Td>
                        </Tr>
                      ))}
                      {r.otherFiles.length ? (
                        <Tr>
                          <Td>
                            <span className="font-semibold text-ink">مرفقات أخرى</span>
                            <span className="t-caption block">لم تعد ضمن متطلبات المبادرة</span>
                          </Td>
                          <Td>
                            <StatusText tone="neutral">مرفق</StatusText>
                          </Td>
                          <Td>
                            <ul className="-my-2 flex flex-col">
                              {r.otherFiles.map((f) => (
                                <FileItem key={f.attachmentId} requestId={r.id} file={f} />
                              ))}
                            </ul>
                          </Td>
                        </Tr>
                      ) : null}
                    </tbody>
                  </DataTable>
                </div>
              )}
            </Section>

            <Section title="فحص الاكتمال" aside="فحص آلي بالقواعد" icon={<ShieldCheck strokeWidth={1.75} />}>
              {!r.completeness ? (
                <p className="t-body flex items-center gap-2 text-sm">
                  <CircleDashed aria-hidden="true" strokeWidth={1.75} className="size-4 text-ink-subtle" />
                  يُجرى الفحص عند تقديم الطلب.
                </p>
              ) : r.completeness.passed ? (
                <p className="flex flex-wrap items-center gap-3 text-sm">
                  <StatusText tone="ok">مكتمل</StatusText>
                  <DateDisplay date={r.completeness.createdAt} withTime className="t-caption" />
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="flex flex-wrap items-center gap-3 text-sm">
                    <StatusText tone="bad">غير مكتمل</StatusText>
                    <DateDisplay date={r.completeness.createdAt} withTime className="t-caption" />
                  </p>
                  <ul className="t-body flex list-disc flex-col gap-1 ps-5 text-sm">
                    {r.completeness.missing.map((m, i) => (
                      <li key={`${m.field}-${i}`}>{m.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>

            <Section
              title="المحادثة"
              icon={<MessagesSquare strokeWidth={1.75} />}
              aside={isStaff && caps.canWriteInternal ? "الملاحظات الداخلية لا تظهر للجمعية" : "مع الوحدة الإشرافية"}
              id="conversation"
            >
              {submitted ? (
                <Conversation
                  requestId={r.id}
                  comments={r.comments}
                  canComment={caps.canComment}
                  canWriteInternal={caps.canWriteInternal}
                  canAttach={caps.canUploadToComment}
                  accept={acceptAttribute(uploads.allowedGroups)}
                  maxMb={uploads.maxMb}
                />
              ) : (
                <p className="t-body text-sm">تتاح المحادثة مع الوحدة الإشرافية بعد تقديم الطلب.</p>
              )}
            </Section>
          </div>

          {/* The side column stays in view while the main column scrolls; it scrolls on its own when
              taller than the screen, so the «القرار» panel at its top never covers the timeline. */}
          <aside className="flex flex-col gap-5 lg:sticky lg:top-[100px] lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pb-1 [&>*]:shrink-0">
            {caps.canDecide ? <DecisionPanel request={dialogRequest} /> : null}

            {caps.canEdit || caps.canDiscard ? (
              <Panel className="flex flex-col gap-3 p-5">
                <div className="mb-1 flex items-center gap-3">
                  <HeaderIcon icon={<PenLine strokeWidth={1.75} />} tone="gold" />
                  <h2 className="t-section">إجراءات الطلب</h2>
                </div>
                {caps.canEdit ? (
                  <Link href={`/association/requests/${r.id}/edit`} className={buttonClasses("primary", "md", "w-full")}>
                    <PenLine aria-hidden="true" strokeWidth={1.75} />
                    {r.status.key === "RETURNED" ? "تعديل الطلب وإعادة تقديمه" : "متابعة تعبئة الطلب"}
                  </Link>
                ) : null}
                {caps.canDiscard ? <DiscardDraftButton requestId={r.id} title={r.title} /> : null}
              </Panel>
            ) : null}

            {r.assignment ? (
              <SideCard
                title="الإسناد"
                icon={<UserRound strokeWidth={1.75} />}
                actions={
                  caps.canReassign ? (
                    <ReassignButton
                      request={dialogRequest}
                      supervisors={r.assignment.candidates.map((c) => ({ id: c.id, name: c.name, programIds: [r.program.id], open: c.open }))}
                    />
                  ) : null
                }
              >
                <div className="text-sm">
                  {r.assignment.supervisor ? (
                    <PersonName name={r.assignment.supervisor.name} />
                  ) : (
                    <span className="text-ink-subtle">لم يُسند بعد</span>
                  )}
                  {r.assignment.supervisor && !r.assignment.supervisor.isActive ? <p className="mt-1 text-xs text-st-warn">حساب المشرف معطل؛ أعد إسناد الطلب.</p> : null}
                </div>
                {r.assignment.history.length ? (
                  <ol className="mt-4 flex flex-col gap-3">
                    {[...r.assignment.history].reverse().map((h) => (
                      <li key={h.id} className="text-sm">
                        <p className="text-ink">
                          {h.to ? `إلى ${h.to}` : "دون مشرف"}
                          {h.from ? <span className="t-caption"> (من {h.from})</span> : null}
                        </p>
                        <p className="t-caption">{h.actor ? `بواسطة ${h.actor}` : "إسناد تلقائي"}</p>
                        {h.reason ? <p className="t-caption whitespace-pre-line">السبب: {h.reason}</p> : null}
                        <DateDisplay date={h.createdAt} withTime className="t-caption" />
                      </li>
                    ))}
                  </ol>
                ) : null}
              </SideCard>
            ) : null}

            <SideCard title="مسار الطلب" icon={<History strokeWidth={1.75} />}>
              <StatusTimeline entries={r.timeline} />
            </SideCard>

            {r.auditTrail ? (
              <SideCard title="سجل الاطلاع والتدقيق" icon={<ScrollText strokeWidth={1.75} />} note="لمدير النظام ومدير الوحدة فقط">
                {r.auditTrail.length === 0 ? (
                  <p className="t-body text-sm">لا توجد قيود بعد.</p>
                ) : (
                  <ol className="flex max-h-96 flex-col gap-3 overflow-y-auto">
                    {r.auditTrail.map((e) => (
                      <li key={e.id} className="text-sm">
                        <p className="text-ink">{auditActionLabel(e.action)}</p>
                        <p className="t-caption">{e.actor ? `${e.actor.name} · ${e.actor.role}` : "النظام"}</p>
                        <DateDisplay date={e.createdAt} withTime className="t-caption" />
                      </li>
                    ))}
                  </ol>
                )}
              </SideCard>
            ) : null}
          </aside>
        </div>
      </PageBody>
    </>
  );
}
