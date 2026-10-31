"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  LoaderCircle,
  PenLine,
  Save,
  Send,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DiscardDraftButton } from "@/components/requests/request-actions";
import { Button } from "@/components/ui/button";
import { hijriCaption } from "@/components/ui/hijri-date-input";
import { Alert } from "@/components/ui/surface";
import type { MissingItem } from "@/lib/completeness";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/toaster";
import { formatHijri, formatNumber, formatTime } from "@/lib/format";
import { GENERAL_FIELD_LABELS, REQUIRED_GENERAL_FIELDS } from "@/lib/requests";
import { REQUEST_LIMITS } from "@/lib/validation/requests";
import { riyadhDateString } from "@/lib/working-days";
import {
  createDraftFromFormAction,
  saveDraftAction,
  submitRequestAction,
} from "@/server/actions/requests";
import { AttachmentCard, type AttachmentCardProps } from "./attachment-card";
import { FIELD_INPUT, FormField, StepCard, StepsAside } from "./fields";

export type WizardDefaults = {
  trackId: string;
  requestTypeId: string;
  title: string;
  description: string;
  goals: string;
  expectedBeneficiaries: string;
  startDate: string;
  endDate: string;
  estimatedBudget: string;
  kpis: string;
  partners: string;
};

export type WizardChoice = {
  id: string;
  name: string;
  description: string | null;
};

type StepKey = "about" | "details" | "files" | "review";
type Step = { key: StepKey; title: string; hint: string; short: string };

const STEPS: Step[] = [
  {
    key: "about",
    title: "عن المشروع",
    hint: "الاسم والمسار ونوع الطلب، ووصف لما تريدون تنفيذه.",
    short: "الاسم والوصف",
  },
  {
    key: "details",
    title: "التفاصيل والموعد",
    hint: "المستفيدون والفترة والميزانية ومؤشرات القياس والشركاء.",
    short: "الأرقام والموعد",
  },
  {
    key: "files",
    title: "المرفقات",
    hint: "الخطة التفصيلية والموازنة وخطابات الشراكة، إن وُجدت.",
    short: "ملفات داعمة",
  },
  {
    key: "review",
    title: "المراجعة والإرسال",
    hint: "راجعوا ما كتبتم، ثم أرسلوا الطلب إلى الوحدة الإشرافية.",
    short: "التأكد ثم الإرسال",
  },
];

const FIELD_STEP: Record<string, StepKey> = {
  trackId: "about",
  requestTypeId: "about",
  title: "about",
  description: "about",
  goals: "about",
  expectedBeneficiaries: "details",
  startDate: "details",
  endDate: "details",
  estimatedBudget: "details",
  kpis: "details",
  partners: "details",
};

/** The step that holds a field of the save or the completeness check. */
function stepOf(field: string): StepKey {
  if (field.startsWith("attachment.")) return "files";
  return FIELD_STEP[field] ?? "review";
}

/** «١٢ رجب ١٤٤٨ هـ» for a YYYY-MM-DD value. */
const hijri = (value: string | undefined) =>
  hijriCaption(value ?? "")?.replace("الموافق ", "") ?? value ?? "";

/**
 * A date picker (the browser's calendar) with the Hijri date written under it as the officer picks.
 * `min` greys out the days before it in the calendar; the server checks the same rule.
 */
function DateField({
  id,
  name,
  value,
  onChange,
  min,
  invalid,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  invalid?: boolean;
}) {
  const caption = hijriCaption(value);
  return (
    <div className="flex flex-col gap-1">
      <input
        id={id}
        name={name}
        type="date"
        dir="ltr"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        className={cn(FIELD_INPUT, "h-11 max-w-60")}
      />
      <span
        className={cn(
          "text-sm",
          caption ? "font-semibold text-primary" : "text-ink-muted",
        )}
        aria-live="polite"
      >
        {caption ?? "اختاروا التاريخ من التقويم، ويظهر هنا بالهجري."}
      </span>
    </div>
  );
}

/** A native select of tracks or request types, with the chosen one's description under it. */
function ChoiceField({
  id,
  name,
  label,
  hint,
  options,
  defaultValue,
  error,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  options: WizardChoice[];
  defaultValue: string;
  error?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const chosen = options.find((o) => o.id === value);
  return (
    <FormField id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={Boolean(error)}
        className={cn(FIELD_INPUT, "h-11")}
      >
        <option value="">اختاروا من القائمة</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {chosen?.description ? (
        <p className="text-sm leading-relaxed text-ink-muted">
          {chosen.description}
        </p>
      ) : null}
    </FormField>
  );
}

function ReviewBlock({
  title,
  onEdit,
  disabled,
  children,
}: {
  title: string;
  onEdit: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-muted px-4 py-2.5">
        <h3 className="text-base font-bold text-ink">{title}</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          disabled={disabled}
        >
          <PenLine aria-hidden="true" strokeWidth={1.75} />
          تعديل
        </Button>
      </header>
      <dl className="px-4">{children}</dl>
    </section>
  );
}

/** One line of the review: what was written, or a clear «لم يُكتب بعد». */
function ReviewRow({
  label,
  children,
  missing,
}: {
  label: string;
  children?: ReactNode;
  missing: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-line py-2.5 last:border-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm font-semibold text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "text-base leading-relaxed",
          missing ? "font-semibold text-st-warn" : "text-ink",
        )}
      >
        {missing ? "لم يُكتب بعد" : children}
      </dd>
    </div>
  );
}

/**
 * The association's request form, one subject per step (D-102, D-123), laid out like the
 * registration journey: the steps at the side, one card per step with «السابق» and «التالي». A new
 * request has no draft yet (`requestId` null): the first «التالي» creates it with what was typed.
 * Moving between steps saves the draft, and so does leaving a field. Any refused value, on saving or
 * sending, opens its step and puts the cursor in the field. The last step shows everything for
 * review and sends the request; the server's completeness check stays the judge.
 */
export function RequestWizard({
  requestId,
  returned,
  returnNote,
  returnedAt,
  defaults,
  tracks,
  requestTypes,
  ownFiles,
  canDiscard,
  requestTitle,
}: {
  /** Null for a new request: the draft is created on the first move to the next step. */
  requestId: string | null;
  returned: boolean;
  returnNote: string | null;
  returnedAt: Date | null;
  defaults: WizardDefaults;
  tracks: WizardChoice[];
  requestTypes: WizardChoice[];
  /** The association's files: the plan, the budget, partnership letters (D-123). */
  ownFiles: Omit<AttachmentCardProps, "error">;
  canDiscard: boolean;
  requestTitle: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = STEPS;
  const [id, setId] = useState(requestId);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  // The start may not be before today (D-123); computed once, in Riyadh time like the server.
  const [today] = useState(() => riyadhDateString(new Date()));

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [missing, setMissing] = useState<MissingItem[]>([]);
  const [busy, setBusy] = useState<null | "move" | "leave" | "submit">(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const current = steps[step];
  const indexOf = (key: StepKey) =>
    Math.max(
      0,
      steps.findIndex((s) => s.key === key),
    );
  const err = (name: string) =>
    errors[name] ?? missing.find((m) => m.field === name)?.message;

  useEffect(
    () => () => {
      if (autosave.current) clearTimeout(autosave.current);
    },
    [],
  );

  /** A save queued by leaving a field is dropped when a button saves (or sends) instead. */
  function cancelAutosave() {
    if (autosave.current) clearTimeout(autosave.current);
    autosave.current = null;
  }

  /** Opens the step that holds a field and puts the cursor in it. */
  function showField(field: string) {
    setStep(indexOf(stepOf(field)));
    // Twice: once for the step to show, once for the layout to settle.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.getElementById(`f-${field}`);
        if (!el) return scrollTop();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }),
    );
  }

  /**
   * Saves everything typed so far, creating the draft the first time; false (the errors shown and
   * the first refused field opened) when the server refuses a value.
   */
  async function save(): Promise<boolean> {
    if (!formRef.current) return false;
    setSaving(true);
    const data = new FormData(formRef.current);
    const r = id
      ? await saveDraftAction(id, {}, data)
      : await createDraftFromFormAction({}, data);
    setSaving(false);
    // The draft exists from here on, even if a value was refused. The address stays as it is: the
    // refresh after each save re-renders the current page, and this one keeps the form's state.
    if (!id && r.createdId) setId(r.createdId);
    if (!r.ok) {
      setErrors(r.errors ?? {});
      const first = Object.keys(r.errors ?? {})[0];
      setFailure(
        first ? null : (r.message ?? "تعذّر حفظ البيانات. أعيدوا المحاولة."),
      );
      if (first) showField(first);
      return false;
    }
    dirty.current = false;
    setErrors({});
    setFailure(null);
    setSavedAt(new Date());
    return true;
  }

  function readValues() {
    if (!formRef.current) return;
    const out: Record<string, string> = {};
    new FormData(formRef.current).forEach((v, k) => {
      if (typeof v === "string") out[k] = v;
    });
    setValues(out);
  }

  function scrollTop() {
    requestAnimationFrame(() =>
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  async function goTo(index: number) {
    if (busy || index === step || index < 0 || index >= steps.length) return;
    cancelAutosave();
    setBusy("move");
    const ok = await save();
    setBusy(null);
    if (!ok) return;
    if (steps[index].key === "review") readValues();
    setMissing([]);
    setStep(index);
    scrollTop();
  }

  async function saveAndLeave() {
    cancelAutosave();
    setBusy("leave");
    const ok = await save();
    setBusy(null);
    if (ok) {
      toast("حُفظ الطلب مسودة", {
        description: "يمكنكم إكماله لاحقًا من «طلباتي».",
      });
      router.push(id ? `/association/requests/${id}` : "/association/requests");
    }
  }

  async function send() {
    if (!formRef.current || !id) return;
    cancelAutosave();
    setBusy("submit");
    setFailure(null);
    const r = await submitRequestAction(id, {}, new FormData(formRef.current));
    if (r.ok) {
      toast(returned ? "أُعيد إرسال الطلب" : "أُرسل الطلب بنجاح", {
        description: "وصل إلى الوحدة الإشرافية.",
      });
      router.push(`/association/requests/${id}?submitted=1`);
      return;
    }
    setBusy(null);
    setErrors(r.errors ?? {});
    setMissing(r.missing ?? []);
    setFailure(r.message ?? "لم يُرسل الطلب.");
    const first = r.missing?.[0]?.field ?? Object.keys(r.errors ?? {})[0];
    if (first && stepOf(first) !== "review") showField(first);
    else scrollTop();
  }

  // Leaving a field saves what was typed, so nothing is lost if the officer closes the page.
  function onFieldLeft() {
    // A new request is saved, and created, by «التالي» only.
    if (!id || !dirty.current || busy) return;
    cancelAutosave();
    autosave.current = setTimeout(() => {
      autosave.current = null;
      void save();
    }, 700);
  }

  // What still needs doing before sending, read from the form as the officer sees it.
  const needs: { label: string; field: string }[] = [];
  if (current.key === "review") {
    if (!values.trackId)
      needs.push({ label: "المسار المستهدف: لم يُختر بعد", field: "trackId" });
    if (!values.requestTypeId)
      needs.push({ label: "نوع الطلب: لم يُختر بعد", field: "requestTypeId" });
    for (const name of [
      ...REQUIRED_GENERAL_FIELDS,
      "estimatedBudget",
      "startDate",
      "endDate",
    ] as const) {
      if (!values[name]?.trim())
        needs.push({
          label: `${GENERAL_FIELD_LABELS[name]}: لم يُكتب بعد`,
          field: name,
        });
    }
  }
  const nameOf = (options: WizardChoice[], id: string | undefined) =>
    options.find((o) => o.id === id)?.name;
  const optional = (v: string | undefined) =>
    v?.trim() ? v : <span className="text-ink-subtle">—</span>;

  const next = steps[step + 1];
  const prev = steps[step - 1];
  const sendLabel = returned ? "إعادة إرسال الطلب" : "إرسال الطلب";

  const savedLine = saving ? (
    <span className="inline-flex items-center gap-2">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      جارٍ حفظ ما كتبتموه…
    </span>
  ) : savedAt ? (
    <span className="inline-flex items-center gap-2">
      <Check
        aria-hidden="true"
        strokeWidth={2.5}
        className="size-4 text-st-ok"
      />
      حُفظ ما كتبتموه في {formatTime(savedAt)}
    </span>
  ) : (
    "يُحفظ ما تكتبونه عند الانتقال بين الخطوات."
  );

  return (
    <div className="flex flex-col gap-5">
      <div ref={topRef} className="scroll-mt-28 lg:scroll-mt-44" />

      {returned ? (
        <Alert
          tone="danger"
          icon={<Undo2 strokeWidth={1.75} />}
          title="أعاد المشرف هذا الطلب إليكم للتعديل"
          className="text-base"
        >
          {returnNote ? (
            <span className="mt-1 block whitespace-pre-line text-ink">
              <span className="font-bold">
                ملاحظات المشرف
                {returnedAt ? ` (${formatHijri(returnedAt)})` : ""}:{" "}
              </span>
              {returnNote}
            </span>
          ) : null}
          <span className="mt-1 block">
            عدّلوا ما يلزم في الخطوات، ثم أعيدوا إرسال الطلب من الخطوة الأخيرة.
          </span>
        </Alert>
      ) : null}

      {failure ? (
        <Alert
          tone="danger"
          icon={<TriangleAlert strokeWidth={1.75} />}
          title={
            missing.length
              ? "لم يُرسل الطلب بعد. أكملوا ما يلي ثم أعيدوا الإرسال:"
              : failure
          }
          className="text-base"
        >
          {missing.length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {missing.map((m, i) => (
                <li
                  key={`${m.field}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface px-3 py-2"
                >
                  <span className="text-ink">{m.message}</span>
                  {stepOf(m.field) !== "review" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => showField(m.field)}
                      disabled={Boolean(busy)}
                    >
                      الذهاب لإكماله
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <StepsAside
          steps={steps.map((s) => ({ title: s.title, hint: s.short }))}
          current={step}
          onSelect={(i) => void goTo(i)}
          disabled={Boolean(busy)}
        >
          <p
            role="status"
            className="hidden rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted lg:block"
          >
            {savedLine}
          </p>
        </StepsAside>

        <StepCard
          number={step + 1}
          total={steps.length}
          title={current.title}
          hint={current.hint}
          footer={
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {prev ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => void goTo(step - 1)}
                    disabled={Boolean(busy)}
                  >
                    <ArrowRight aria-hidden="true" strokeWidth={1.75} />
                    السابق
                  </Button>
                ) : (
                  <span />
                )}
                {next ? (
                  <Button
                    variant="gold"
                    size="lg"
                    onClick={() => void goTo(step + 1)}
                    disabled={Boolean(busy)}
                  >
                    {busy === "move" ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="animate-spin"
                      />
                    ) : null}
                    التالي: {next.title}
                    {busy === "move" ? null : (
                      <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="gold"
                    size="lg"
                    onClick={() => void send()}
                    disabled={Boolean(busy)}
                  >
                    {busy === "submit" ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="animate-spin"
                      />
                    ) : (
                      <Send aria-hidden="true" strokeWidth={1.75} />
                    )}
                    {busy === "submit" ? "جارٍ الإرسال…" : sendLabel}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <p role="status" className="text-sm text-ink-muted lg:hidden">
                  {savedLine}
                </p>
                <Button
                  variant="ghost"
                  onClick={() => void saveAndLeave()}
                  disabled={Boolean(busy)}
                  className="ms-auto"
                >
                  {busy === "leave" ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Save aria-hidden="true" strokeWidth={1.75} />
                  )}
                  حفظ والعودة لاحقًا
                </Button>
              </div>
            </div>
          }
        >
          <form
            ref={formRef}
            noValidate
            onSubmit={(e) => e.preventDefault()}
            onInput={() => {
              dirty.current = true;
            }}
            onBlur={onFieldLeft}
          >
            {current.key === "about" || current.key === "details" ? (
              <p className="mb-5 text-sm text-ink-muted">
                الحقول المطلوبة عليها علامة «*»؛ وما سواها اختياري، ويساعد
                المشرف على دراسة طلبكم.
              </p>
            ) : null}

            {/* Every step stays in the form (hidden when not shown), so saving always sends everything. */}
            <section
              hidden={current.key !== "about"}
              className="flex flex-col gap-6"
            >
              <FormField
                id="f-title"
                label={`${GENERAL_FIELD_LABELS.title} *`}
                hint="اسم مختصر للمشروع. مثال: برنامج تحفيظ القرآن الكريم لضيوف الرحمن في رمضان."
                error={err("title")}
              >
                <input
                  id="f-title"
                  name="title"
                  defaultValue={defaults.title}
                  maxLength={REQUEST_LIMITS.title}
                  aria-invalid={Boolean(err("title"))}
                  className={cn(FIELD_INPUT, "h-11")}
                />
              </FormField>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ChoiceField
                  id="f-trackId"
                  name="trackId"
                  label="المسار المستهدف *"
                  hint="المجال الذي يخدمه مشروعكم."
                  options={tracks}
                  defaultValue={defaults.trackId}
                  error={err("trackId")}
                />
                <ChoiceField
                  id="f-requestTypeId"
                  name="requestTypeId"
                  label="نوع الطلب *"
                  hint="ماذا تطلبون من الوحدة الإشرافية؟"
                  options={requestTypes}
                  defaultValue={defaults.requestTypeId}
                  error={err("requestTypeId")}
                />
              </div>
              <FormField
                id="f-description"
                label={`${GENERAL_FIELD_LABELS.description} *`}
                hint="اكتبوا بإيجاز: ماذا ستنفذون، ولمن، وأين، وما الأنشطة الرئيسة."
                error={err("description")}
              >
                <textarea
                  id="f-description"
                  name="description"
                  rows={6}
                  defaultValue={defaults.description}
                  maxLength={REQUEST_LIMITS.description}
                  aria-invalid={Boolean(err("description"))}
                  className={cn(FIELD_INPUT, "py-2.5 leading-relaxed")}
                />
              </FormField>
              <FormField
                id="f-goals"
                label={`${GENERAL_FIELD_LABELS.goals} *`}
                hint="ماذا تريدون أن تحققوا؟ مثال: تحفيظ جزأين لكل مستفيد مواظب، وتأهيل ٤٠ معلمًا متطوعًا."
                error={err("goals")}
              >
                <textarea
                  id="f-goals"
                  name="goals"
                  rows={4}
                  defaultValue={defaults.goals}
                  maxLength={REQUEST_LIMITS.goals}
                  aria-invalid={Boolean(err("goals"))}
                  className={cn(FIELD_INPUT, "py-2.5 leading-relaxed")}
                />
              </FormField>
            </section>

            <section
              hidden={current.key !== "details"}
              className="flex flex-col gap-6"
            >
              <FormField
                id="f-expectedBeneficiaries"
                label={`${GENERAL_FIELD_LABELS.expectedBeneficiaries} *`}
                hint="من يستفيد من المشروع؟ اكتبوا كل فئة في سطر. مثال: العاملون والعاملات في قطاع الحج والعمرة."
                error={err("expectedBeneficiaries")}
              >
                <textarea
                  id="f-expectedBeneficiaries"
                  name="expectedBeneficiaries"
                  rows={4}
                  defaultValue={defaults.expectedBeneficiaries}
                  maxLength={REQUEST_LIMITS.beneficiaries}
                  aria-invalid={Boolean(err("expectedBeneficiaries"))}
                  className={cn(FIELD_INPUT, "py-2.5 leading-relaxed")}
                />
              </FormField>
              <div className="max-w-md">
                <FormField
                  id="f-estimatedBudget"
                  label={`${GENERAL_FIELD_LABELS.estimatedBudget} *`}
                  hint="بالريال السعودي. مثال: ٤٨٠٠٠٠"
                  error={err("estimatedBudget")}
                >
                  <input
                    id="f-estimatedBudget"
                    name="estimatedBudget"
                    inputMode="numeric"
                    defaultValue={defaults.estimatedBudget}
                    maxLength={18}
                    aria-invalid={Boolean(err("estimatedBudget"))}
                    className={cn(FIELD_INPUT, "h-11")}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  id="f-startDate"
                  label={`${GENERAL_FIELD_LABELS.startDate} *`}
                  hint="متى يبدأ التنفيذ؟ اليوم أو بعده."
                  error={err("startDate")}
                >
                  <DateField
                    id="f-startDate"
                    name="startDate"
                    value={startDate}
                    onChange={setStartDate}
                    min={today}
                    invalid={Boolean(err("startDate"))}
                  />
                </FormField>
                <FormField
                  id="f-endDate"
                  label={`${GENERAL_FIELD_LABELS.endDate} *`}
                  hint="متى ينتهي؟ لا يسبق تاريخ البداية."
                  error={err("endDate")}
                >
                  <DateField
                    id="f-endDate"
                    name="endDate"
                    value={endDate}
                    onChange={setEndDate}
                    min={startDate || today}
                    invalid={Boolean(err("endDate"))}
                  />
                </FormField>
              </div>
              <FormField
                id="f-kpis"
                label={GENERAL_FIELD_LABELS.kpis}
                hint="كيف ستقيسون النجاح؟ مثال: عدد الأجزاء المحفوظة، نسبة الحضور، رضا المستفيدين."
                error={err("kpis")}
                optional
              >
                <input
                  id="f-kpis"
                  name="kpis"
                  defaultValue={defaults.kpis}
                  maxLength={REQUEST_LIMITS.kpis}
                  aria-invalid={Boolean(err("kpis"))}
                  className={cn(FIELD_INPUT, "h-11")}
                />
              </FormField>
              <FormField
                id="f-partners"
                label={GENERAL_FIELD_LABELS.partners}
                hint="الجهات المشاركة في التنفيذ أو الدعم، إن وُجدت."
                error={err("partners")}
                optional
              >
                <input
                  id="f-partners"
                  name="partners"
                  defaultValue={defaults.partners}
                  maxLength={REQUEST_LIMITS.partners}
                  aria-invalid={Boolean(err("partners"))}
                  className={cn(FIELD_INPUT, "h-11")}
                />
              </FormField>
            </section>
          </form>

          {current.key === "files" ? (
            <section
              aria-labelledby="own-files"
              className="flex flex-col gap-3"
            >
              <div>
                <h3 id="own-files" className="text-base font-bold text-ink">
                  الملفات الداعمة لطلبكم
                </h3>
                <p className="mt-0.5 text-sm text-ink-muted">
                  اختياري. مثل الخطة التفصيلية، والموازنة، وخطابات الشراكة.
                  يُحفظ كل ملف فور رفعه، ويراه المشرف مع طلبكم.
                </p>
              </div>
              {id ? <AttachmentCard {...ownFiles} requestId={id} /> : null}
            </section>
          ) : null}

          {current.key === "review" ? (
            <div className="flex flex-col gap-5">
              {/* After a refused send the server's list (above) is the one to follow. */}
              {missing.length ? null : needs.length === 0 ? (
                <Alert
                  tone="success"
                  icon={<CircleCheck strokeWidth={1.75} />}
                  title="الطلب مكتمل وجاهز للإرسال"
                  className="text-base"
                >
                  راجعوا البيانات أدناه، ثم اضغطوا «{sendLabel}».
                </Alert>
              ) : (
                <Alert
                  tone="danger"
                  icon={<TriangleAlert strokeWidth={1.75} />}
                  title="قبل الإرسال، أكملوا ما يلي:"
                  className="text-base"
                >
                  <ul className="mt-2 flex flex-col gap-2">
                    {needs.map((n) => (
                      <li
                        key={n.label}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface px-3 py-2"
                      >
                        <span className="text-ink">{n.label}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => showField(n.field)}
                          disabled={Boolean(busy)}
                        >
                          الذهاب لإكماله
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}

              <ReviewBlock
                title="عن المشروع"
                onEdit={() => void goTo(indexOf("about"))}
                disabled={Boolean(busy)}
              >
                <ReviewRow
                  label={GENERAL_FIELD_LABELS.title}
                  missing={!values.title?.trim()}
                >
                  {values.title}
                </ReviewRow>
                <ReviewRow label="المسار المستهدف" missing={!values.trackId}>
                  {nameOf(tracks, values.trackId)}
                </ReviewRow>
                <ReviewRow label="نوع الطلب" missing={!values.requestTypeId}>
                  {nameOf(requestTypes, values.requestTypeId)}
                </ReviewRow>
                <ReviewRow
                  label={GENERAL_FIELD_LABELS.description}
                  missing={!values.description?.trim()}
                >
                  <span className="whitespace-pre-line">
                    {values.description}
                  </span>
                </ReviewRow>
                <ReviewRow
                  label={GENERAL_FIELD_LABELS.goals}
                  missing={!values.goals?.trim()}
                >
                  <span className="whitespace-pre-line">{values.goals}</span>
                </ReviewRow>
              </ReviewBlock>

              <ReviewBlock
                title="التفاصيل والموعد"
                onEdit={() => void goTo(indexOf("details"))}
                disabled={Boolean(busy)}
              >
                <ReviewRow
                  label={GENERAL_FIELD_LABELS.expectedBeneficiaries}
                  missing={!values.expectedBeneficiaries?.trim()}
                >
                  <span className="whitespace-pre-line">
                    {values.expectedBeneficiaries}
                  </span>
                </ReviewRow>
                <ReviewRow
                  label={GENERAL_FIELD_LABELS.estimatedBudget}
                  missing={!values.estimatedBudget?.trim()}
                >
                  {values.estimatedBudget}
                </ReviewRow>
                <ReviewRow
                  label={GENERAL_FIELD_LABELS.startDate}
                  missing={!values.startDate}
                >
                  {hijri(values.startDate)}
                </ReviewRow>
                <ReviewRow
                  label={GENERAL_FIELD_LABELS.endDate}
                  missing={!values.endDate}
                >
                  {hijri(values.endDate)}
                </ReviewRow>
                <ReviewRow label={GENERAL_FIELD_LABELS.kpis} missing={false}>
                  {optional(values.kpis)}
                </ReviewRow>
                <ReviewRow
                  label={GENERAL_FIELD_LABELS.partners}
                  missing={false}
                >
                  {optional(values.partners)}
                </ReviewRow>
              </ReviewBlock>

              <ReviewBlock
                title="المرفقات"
                onEdit={() => void goTo(indexOf("files"))}
                disabled={Boolean(busy)}
              >
                <ReviewRow label="الملفات" missing={false}>
                  {ownFiles.files.length === 0 ? (
                    <span className="text-ink-subtle">لم تُرفق ملفات</span>
                  ) : ownFiles.files.length === 1 ? (
                    "أُرفق ملف واحد"
                  ) : (
                    `أُرفقت ${formatNumber(ownFiles.files.length)} ملفات`
                  )}
                </ReviewRow>
              </ReviewBlock>

              <p className="rounded-lg border-s-4 border-accent bg-accent-soft/60 px-4 py-3 text-base text-ink">
                عند الإرسال يصل الطلب إلى الوحدة الإشرافية، ولا يمكن تعديله بعد
                ذلك إلا إذا أعاده المشرف إليكم.
              </p>

              {canDiscard && id ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <p className="text-sm text-ink-muted">
                    لا تريدون هذا الطلب؟ يمكنكم حذف المسودة نهائيًا.
                  </p>
                  <DiscardDraftButton requestId={id} title={requestTitle} />
                </div>
              ) : null}
            </div>
          ) : null}
        </StepCard>
      </div>
    </div>
  );
}
