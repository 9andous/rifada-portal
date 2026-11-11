"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  PenLine,
  Save,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DiscardDraftButton } from "@/components/requests/request-actions";
import { Button } from "@/components/ui/button";
import { ReferenceCard } from "@/components/requests/reference-card";
import { HijriDateInput } from "@/components/ui/hijri-date-input";
import { Alert } from "@/components/ui/surface";
import { MAX_SPAN_DAYS, type MissingItem } from "@/lib/completeness";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/toaster";
import { formatHijri, formatHijriDateTime, formatNumber, formatTime, isoPlusDays, toArabicDigits } from "@/lib/format";
import { formatGoals, formatTargetGroups, GENERAL_FIELD_LABELS, parseGoals, parseTargetGroups, REQUIRED_GENERAL_FIELDS, type RequestGoal, type TargetGroup } from "@/lib/requests";
import { REQUEST_LIMITS } from "@/lib/validation/requests";
import { riyadhDateString } from "@/lib/working-days";
import {
  createDraftFromFormAction,
  saveDraftAction,
  submitRequestAction,
} from "@/server/actions/requests";
import { AttachmentCard, type AttachmentCardProps } from "./attachment-card";
import { FIELD_INPUT, FormField, StepCard, StepsAside } from "./fields";
import {
  CheckList,
  GoalsField,
  SelectField,
  TargetGroupsField,
  type WizardChoice,
  type WizardProgram,
  type WizardRequestType,
  type WizardTrack,
} from "./request-scope-fields";

export type { WizardChoice, WizardProgram, WizardRequestType, WizardTrack };

export type WizardDefaults = {
  trackId: string;
  requestTypeId: string;
  /** What the association wrote for a type that asks for it, such as «أخرى» (D-151). */
  requestTypeDetail: string;
  /** The programme of the track and its chosen initiatives (D-151). */
  programId: string;
  initiativeIds: string[];
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

type StepKey = "about" | "details" | "files" | "review";
type Step = { key: StepKey; title: string; hint: string; short: string };

const STEPS: Step[] = [
  {
    key: "about",
    title: "عن المشروع",
    hint: "اسم البرنامج المقترح والمسار والبرنامج والمبادرات.",
    short: "الاسم والبرنامج",
  },
  {
    key: "details",
    title: "التفاصيل والموعد",
    hint: "نوع الطلب، والوصف والأهداف ومؤشراتها، والمستفيدون والفترة والميزانية والشركاء.",
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
    programId: "about",
  initiativeIds: "about",
  title: "about",
  description: "details",
  goals: "details",
  expectedBeneficiaries: "details",
  startDate: "details",
  endDate: "details",
  estimatedBudget: "details",
  kpis: "details",
  partners: "details",
  requestTypeId: "details",
  requestTypeDetail: "details",
};

/** The step that holds a field of the save or the completeness check. */
function stepOf(field: string): StepKey {
  if (field.startsWith("attachment.")) return "files";
  return FIELD_STEP[field] ?? "review";
}

/** «١٢ رجب ١٤٤٨ هـ» for a YYYY-MM-DD value. */
const hijri = (value: string | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatHijri(new Date(`${value}T12:00:00Z`)) : "";

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
  programs,
  requestTypes,
  ownFiles,
  canDiscard,
  requestTitle,
  initialStep = 0,
}: {
  /** Null for a new request: the draft is created on the first move to the next step. */
  requestId: string | null;
  /** The step to open on (the edit page's `?step=`, after a new request's draft is created). */
  initialStep?: number;
  returned: boolean;
  returnNote: string | null;
  returnedAt: Date | null;
  defaults: WizardDefaults;
  tracks: WizardTrack[];
  /** The programmes with their goals and initiatives; each track offers those it covers (D-151). */
  programs: WizardProgram[];
  requestTypes: WizardRequestType[];
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

  // What the association picks (D-151): the track, then a programme it covers and one or more of the
  // programme's initiatives. The goals it writes itself, each with its measure.
  const [trackId, setTrackId] = useState(defaults.trackId);
  const [programId, setProgramId] = useState(defaults.programId);
  const [initiativeIds, setInitiativeIds] = useState(defaults.initiativeIds);
  const [requestTypeId, setRequestTypeId] = useState(defaults.requestTypeId);
  const [goals, setGoals] = useState<RequestGoal[]>(() => parseGoals(defaults.goals));
  const [groups, setGroups] = useState<TargetGroup[]>(() => parseTargetGroups(defaults.expectedBeneficiaries));
  const track = tracks.find((t) => t.id === trackId);
  const trackPrograms = track ? programs.filter((p) => track.programIds.includes(p.id)) : [];
  const program = trackPrograms.find((p) => p.id === programId);
  const requestType = requestTypes.find((t) => t.id === requestTypeId);
  const goalsText = formatGoals(goals);
  const groupsText = formatTargetGroups(groups);

  function touch(...fields: string[]) {
    dirty.current = true;
    clearFieldErrors(...fields);
  }

  function changeTrack(next: string) {
    touch("trackId", "programId", "initiativeIds");
    setTrackId(next);
    const covered = tracks.find((t) => t.id === next)?.programIds ?? [];
    if (programId && !covered.includes(programId)) changeProgram("");
  }

  function changeProgram(next: string) {
    touch("programId", "initiativeIds");
    setProgramId(next);
    setInitiativeIds([]);
  }
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  // The start may not be before today (D-123); computed once, in Riyadh time like the server.
  const [today] = useState(() => riyadhDateString(new Date()));
  // The end follows the start (D-141): a start that leaves the end outside the allowed period clears it.
  const latestEnd = startDate ? isoPlusDays(startDate, MAX_SPAN_DAYS) : undefined;
  function changeStartDate(next: string) {
    dirty.current = true;
    clearFieldErrors("startDate", "endDate");
    setStartDate(next);
    if (next && endDate && (endDate < next || endDate > isoPlusDays(next, MAX_SPAN_DAYS))) {
      setEndDate("");
      toast("اختاروا تاريخ النهاية من جديد", { description: "لم يعد يناسب تاريخ البداية الجديد." });
    }
  }

  function changeEndDate(next: string) {
    dirty.current = true;
    clearFieldErrors("endDate");
    setEndDate(next);
  }

  const [step, setStep] = useState(() => Math.min(Math.max(0, initialStep), STEPS.length - 1));
  const created = useRef<string | null>(null);
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

  /** A field the officer changes drops its message; the server checks it again at the next save or send. */
  function clearFieldErrors(...names: string[]) {
    setErrors((all) => (names.some((n) => all[n]) ? Object.fromEntries(Object.entries(all).filter(([k]) => !names.includes(k))) : all));
    const left = missing.filter((m) => !names.includes(m.field));
    if (left.length === missing.length) return;
    setMissing(left);
    // Nothing left of a refused send: its banner goes too.
    if (left.length === 0) setFailure(null);
  }

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
    // The draft exists from here on, even if a value was refused. The next successful move continues
    // on the draft's own edit page, so its files are read back from the server (owner's review, D-130).
    if (!id && r.createdId) {
      setId(r.createdId);
      created.current = r.createdId;
    }
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

  // Opened straight on the review step: read the saved values the review lists.
  useEffect(() => {
    if (steps[step].key === "review") readValues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!requestId && created.current) {
      router.replace(`/association/requests/${created.current}/edit?step=${index}`, { scroll: false });
      return;
    }
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
      // The reference number goes in the pop-up, which stays until «حسنًا» so it is not missed (D-124, D-150).
      toast(returned ? "أُعيد إرسال الطلب" : "تم إرسال طلبكم بنجاح", {
        description: r.referenceNo ? <ReferenceCard value={r.referenceNo} /> : "وصل إلى الوحدة الإشرافية.",
        persist: Boolean(r.referenceNo),
      });
      router.push(`/association/requests/${id}`);
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
    if (!values.programId)
      needs.push({ label: "البرنامج: لم يُختر بعد", field: "programId" });
    else if (initiativeIds.length === 0)
      needs.push({ label: "المبادرات: لم تُختر مبادرة بعد", field: "initiativeIds" });
    if (!values.requestTypeId)
      needs.push({ label: "نوع الطلب: لم يُختر بعد", field: "requestTypeId" });
    else if (requestType?.requiresDetail && !values.requestTypeDetail?.trim())
      needs.push({ label: `نوع الطلب: اكتبوا ما تطلبونه في «${requestType.name}»`, field: "requestTypeDetail" });
    for (const g of goals.filter((x) => x.goal.trim() && !x.measure.trim()))
      needs.push({ label: `الأهداف: اكتبوا مؤشر القياس للهدف «${g.goal.trim()}»`, field: "goals" });
    for (const g of groups.filter((x) => x.name.trim() && !x.count))
      needs.push({ label: `الفئات المستهدفة: اكتبوا العدد المستهدف لفئة «${g.name.trim()}»`, field: "expectedBeneficiaries" });
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
          title="أعاد المشرف هذا الطلب إليكم للتعديل"
          className="text-base"
        >
          {returnNote ? (
            <span className="mt-1 block whitespace-pre-line text-ink">
              <span className="font-bold">
                ملاحظات المشرف
                {returnedAt ? ` (${formatHijriDateTime(returnedAt)})` : ""}:{" "}
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
            onInput={(e) => {
              dirty.current = true;
              const name = (e.target as HTMLInputElement).name;
              if (name) clearFieldErrors(name);
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
              <SelectField
                id="f-trackId"
                name="trackId"
                label="المسار المستهدف *"
                hint="المجال الذي يخدمه مشروعكم، من تصنيف المستوى (ب) للوحدة الإشرافية."
                options={tracks}
                value={trackId}
                onChange={changeTrack}
                error={err("trackId")}
              />
              <SelectField
                id="f-programId"
                name="programId"
                label="البرنامج *"
                hint={track ? "برنامج رئاسة الشؤون الدينية الذي يندرج تحته مشروعكم." : "يُرجى اختيار المسار المستهدف أولًا."}
                options={trackPrograms.map((p) => ({ id: p.id, name: p.name, description: p.description }))}
                value={program ? programId : ""}
                onChange={changeProgram}
                disabled={!track}
                placeholder={track ? "يُرجى اختيار البرنامج" : "يُرجى اختيار المسار المستهدف أولًا"}
                error={err("programId")}
              />
              {program ? (
                <CheckList
                  id="f-initiativeIds"
                  name="initiativeIds"
                  label="المبادرات *"
                  hint="اختاروا مبادرة واحدة أو أكثر من مبادرات البرنامج يخدمها مشروعكم."
                  options={program.initiatives.map((i) => ({ value: i.id, label: i.name, number: i.number }))}
                  values={initiativeIds}
                  onChange={(next) => {
                    touch("initiativeIds");
                    setInitiativeIds(next);
                  }}
                  error={err("initiativeIds")}
                  empty="لا توجد مبادرات متاحة في هذا البرنامج."
                />
              ) : null}
            </section>

            <section
              hidden={current.key !== "details"}
              className="flex flex-col gap-6"
            >
              <SelectField
                id="f-requestTypeId"
                name="requestTypeId"
                label="نوع الطلب *"
                hint="ماذا تطلبون من الوحدة الإشرافية؟"
                options={requestTypes}
                value={requestTypeId}
                onChange={(next) => {
                  touch("requestTypeId", "requestTypeDetail");
                  setRequestTypeId(next);
                }}
                error={err("requestTypeId")}
              />
              {requestType?.requiresDetail ? (
                <FormField
                  id="f-requestTypeDetail"
                  label="اكتبوا نوع الطلب الذي تريدونه *"
                  hint="بإيجاز. مثال: طلب تمديد فترة تنفيذ مشروع قائم."
                  error={err("requestTypeDetail")}
                >
                  <input
                    id="f-requestTypeDetail"
                    name="requestTypeDetail"
                    defaultValue={defaults.requestTypeDetail}
                    maxLength={REQUEST_LIMITS.requestTypeDetail}
                    aria-invalid={Boolean(err("requestTypeDetail"))}
                    className={cn(FIELD_INPUT, "h-11")}
                  />
                </FormField>
              ) : null}
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
              <GoalsField
                id="f-goals"
                label={`${GENERAL_FIELD_LABELS.goals} *`}
                goals={goals}
                onChange={(next) => {
                  touch("goals");
                  setGoals(next);
                }}
                error={err("goals")}
              />
              <input type="hidden" name="goals" value={goalsText} />
              <TargetGroupsField
                id="f-expectedBeneficiaries"
                label={`${GENERAL_FIELD_LABELS.expectedBeneficiaries} *`}
                groups={groups}
                onChange={(next) => {
                  touch("expectedBeneficiaries");
                  setGroups(next);
                }}
                error={err("expectedBeneficiaries")}
              />
              <input type="hidden" name="expectedBeneficiaries" value={groupsText} />
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
                  <HijriDateInput
                    id="f-startDate"
                    name="startDate"
                    value={startDate}
                    onChange={changeStartDate}
                    min={today}
                    invalid={Boolean(err("startDate"))}
                  />
                </FormField>
                <FormField
                  id="f-endDate"
                  label={`${GENERAL_FIELD_LABELS.endDate} *`}
                  hint="متى ينتهي؟ يُختار بعد تاريخ البداية، ولا يسبقه."
                  error={err("endDate")}
                >
                  <HijriDateInput
                    id="f-endDate"
                    name="endDate"
                    value={endDate}
                    onChange={changeEndDate}
                    min={startDate || today}
                    max={latestEnd}
                    disabled={!startDate}
                    placeholder={startDate ? undefined : "يُرجى اختيار تاريخ البداية أولًا"}
                    invalid={Boolean(err("endDate"))}
                  />
                </FormField>
              </div>
              <FormField
                id="f-kpis"
                label={`${GENERAL_FIELD_LABELS.kpis} *`}
                hint="كيف ستقيسون النجاح؟ مثال: عدد الأجزاء المحفوظة، نسبة الحضور، رضا المستفيدين."
                error={err("kpis")}
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
                  title="الطلب مكتمل وجاهز للإرسال"
                  className="text-base"
                >
                  راجعوا البيانات أدناه، ثم اضغطوا «{sendLabel}».
                </Alert>
              ) : (
                <Alert
                  tone="danger"
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
                <ReviewRow label="البرنامج" missing={!program}>
                  {program?.name}
                </ReviewRow>
                <ReviewRow label="المبادرات" missing={initiativeIds.length === 0}>
                  <ul className="flex flex-col gap-1">
                    {(program?.initiatives ?? [])
                      .filter((i) => initiativeIds.includes(i.id))
                      .map((i) => (
                        <li key={i.id}>
                          {toArabicDigits(i.number)}. {i.name}
                        </li>
                      ))}
                  </ul>
                </ReviewRow>
              </ReviewBlock>

              <ReviewBlock
                title="التفاصيل والموعد"
                onEdit={() => void goTo(indexOf("details"))}
                disabled={Boolean(busy)}
              >
                <ReviewRow label="نوع الطلب" missing={!values.requestTypeId}>
                  {nameOf(requestTypes, values.requestTypeId)}
                  {requestType?.requiresDetail && values.requestTypeDetail?.trim() ? `: ${values.requestTypeDetail.trim()}` : ""}
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
                  <ul className="flex flex-col gap-1">
                    {goals.filter((g) => g.goal.trim()).map((g, i) => (
                      <li key={i} className="flex flex-wrap gap-x-2">
                        <span>{g.goal}</span>
                        <span className={g.measure.trim() ? "text-ink-muted" : "text-st-warn"}>
                          {g.measure.trim() ? `مؤشر القياس: ${g.measure}` : "مؤشر القياس لم يُكتب"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ReviewRow>
                <ReviewRow
                  label={GENERAL_FIELD_LABELS.expectedBeneficiaries}
                  missing={!values.expectedBeneficiaries?.trim()}
                >
                  <ul className="flex flex-col gap-1">
                    {parseTargetGroups(groupsText).map((g, i) => (
                      <li key={i} className="flex flex-wrap gap-x-2">
                        <span>{g.name}</span>
                        <span className={cn("t-figure font-semibold", g.count ? "text-ink" : "text-st-warn")}>
                          {g.count ? `${formatNumber(Number(g.count))} مستفيد` : "العدد لم يُكتب"}
                        </span>
                      </li>
                    ))}
                  </ul>
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
                <ReviewRow label={GENERAL_FIELD_LABELS.kpis} missing={!values.kpis?.trim()}>
                  {values.kpis}
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
