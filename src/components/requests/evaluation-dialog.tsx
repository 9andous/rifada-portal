"use client";

import { ArrowRight, Check, LoaderCircle, MessageSquarePlus, PenLine, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, FormError, StatusText } from "@/components/ui/surface";
import { toast } from "@/components/ui/toaster";
import { REVIEW_CRITERIA, type CriterionResult, type ReviewCriterionKey } from "@/config/review-criteria";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { RECOMMENDATION_LABELS, RECOMMENDATION_TONES, type Decision } from "@/lib/requests";
import { REQUEST_LIMITS } from "@/lib/validation/requests";
import { editEvaluationAction, evaluateAction } from "@/server/actions/requests";

const RECOMMENDATIONS: { value: Decision; label: string; on: string }[] = [
  { value: "approve", label: "التوصية بالقبول", on: "border-st-ok bg-st-ok-soft text-st-ok" },
  { value: "return", label: "التوصية بالإعادة للتعديل", on: "border-st-warn bg-st-warn-soft text-st-warn" },
  { value: "reject", label: "التوصية بالرفض", on: "border-st-bad bg-st-bad-soft text-st-bad" },
];

type Answer = { met: boolean | null; note: string; noteOpen: boolean };
export type Answers = Record<ReviewCriterionKey, Answer>;

const fresh = () => Object.fromEntries(REVIEW_CRITERIA.map((c) => [c.key, { met: null, note: "", noteOpen: false }])) as Record<ReviewCriterionKey, Answer>;

/**
 * «تقييم واعتماد» (D-116, compact per the owner, D-117; D-139, D-145): first the acceptance criteria, each
 * ✓ or ✗ with a note only when asked for, «ملاحظة المراجع الفني» and the supervisor's recommendation to
 * the unit manager, with a reason when returning or rejecting; then «توقيع وإرسال إلى مدير الوحدة» asks
 * for the password, and the server seals it electronically (D-122).
 */
export function EvaluationDialog({
  requestId,
  size,
  className,
  children,
}: {
  requestId: string;
  size?: "sm" | "md";
  className?: string;
  /** The trigger button's content. */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"criteria" | "sign">("criteria");
  const [answers, setAnswers] = useState<Record<ReviewCriterionKey, Answer>>(fresh);
  const [note, setNote] = useState("");
  const [recommendation, setRecommendation] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const answered = REVIEW_CRITERIA.filter((c) => answers[c.key].met !== null).length;
  const met = REVIEW_CRITERIA.filter((c) => answers[c.key].met === true).length;
  const needsReason = recommendation === "return" || recommendation === "reject";
  const complete = answered === REVIEW_CRITERIA.length && recommendation !== null && (!needsReason || reason.trim().length >= 3);

  async function submit() {
    if (!recommendation) return;
    setErrors({});
    setMessage(null);
    setPending(true);
    const r = await evaluateAction(requestId, {
      criteria: REVIEW_CRITERIA.map((c) => ({ key: c.key, met: answers[c.key].met === true, note: answers[c.key].note })),
      note,
      recommendation,
      reason,
      password,
    });
    setPending(false);
    if (!r.ok) {
      setErrors(r.errors ?? {});
      if (!r.errors?.password) setMessage(r.message ?? "تعذّر حفظ التقييم.");
      if (r.errors?.criteria || r.errors?.note || r.errors?.reason || r.errors?.recommendation) setStep("criteria");
      setPassword("");
      return;
    }
    setOpen(false);
    toast("رُفعت توصيتك إلى مدير الوحدة", { description: "القرار النهائي لمدير الوحدة." });
    router.refresh();
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (pending) return;
        setOpen(v);
        if (v) {
          setStep("criteria");
          setAnswers(fresh());
          setNote("");
          setRecommendation(null);
          setReason("");
          setPassword("");
          setErrors({});
          setMessage(null);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="primary" size={size} className={className}>
          {children}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)]" />
        <Dialog.Content className="fixed inset-x-0 top-1/2 z-50 mx-auto flex max-h-[92vh] w-[min(95vw,38rem)] -translate-y-1/2 flex-col overflow-clip rounded-2xl border border-line bg-surface shadow-3 focus:outline-none">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
            <Dialog.Title className="t-section">{step === "criteria" ? "معايير القبول والامتثال" : "التوقيع الإلكتروني"}</Dialog.Title>
            <div className="flex items-center gap-3">
              <span className="t-caption">
                {step === "criteria" ? `${formatNumber(answered)} / ${formatNumber(REVIEW_CRITERIA.length)}` : `مستوفى ${formatNumber(met)} من ${formatNumber(REVIEW_CRITERIA.length)}`}
              </span>
              <Dialog.Close className="text-ink-subtle hover:text-ink" aria-label="إغلاق" disabled={pending}>
                <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
              </Dialog.Close>
            </div>
          </div>
          <Dialog.Description className="sr-only">تقييم الطلب وفق معايير القبول والامتثال، ثم التوقيع ورفع التوصية إلى مدير الوحدة.</Dialog.Description>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {message ? (
              <FormError className="mb-3">
                {message}
              </FormError>
            ) : null}

            {step === "criteria" ? (
              <>
                <CriteriaFields answers={answers} setAnswers={setAnswers} note={note} setNote={setNote} errors={errors} />
                <fieldset className="mt-4">
                  <legend className="text-sm font-semibold text-ink">
                    توصيتك إلى مدير الوحدة <span className="text-danger">*</span>
                  </legend>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {RECOMMENDATIONS.map((o) => (
                      <label
                        key={o.value}
                        className={cn(
                          "relative flex cursor-pointer items-center justify-center rounded-md border px-3 py-2.5 text-center text-sm font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus",
                          recommendation === o.value ? o.on : "border-line-strong bg-surface text-ink hover:border-primary",
                        )}
                      >
                        <input type="radio" name="eval-recommendation" value={o.value} checked={recommendation === o.value} onChange={() => setRecommendation(o.value)} className="sr-only" />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {needsReason ? (
                  <Field id="eval-reason" label="سبب التوصية" hint="يطّلع عليه مدير الوحدة، ولا يصل إلى الجمعية إلا إذا أكّد القرار." error={errors.reason} required className="mt-4">
                    <Textarea id="eval-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={REQUEST_LIMITS.reason} aria-invalid={Boolean(errors.reason)} />
                  </Field>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col gap-3">
                {recommendation ? (
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    توصيتك:
                    <StatusText tone={RECOMMENDATION_TONES[recommendation]}>{RECOMMENDATION_LABELS[recommendation]}</StatusText>
                  </p>
                ) : null}
                <SealNotice />
                <Field id="eval-password" label="كلمة المرور" error={errors.password} required>
                  <PasswordInput id="eval-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" aria-invalid={Boolean(errors.password)} />
                </Field>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3.5">
            {step === "criteria" ? (
              <>
                <Dialog.Close asChild>
                  <Button variant="ghost">إلغاء</Button>
                </Dialog.Close>
                <Button variant="primary" onClick={() => setStep("sign")} disabled={!complete}>
                  <PenLine aria-hidden="true" strokeWidth={1.75} />
                  توقيع وإرسال إلى مدير الوحدة
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setStep("criteria")} disabled={pending}>
                  <ArrowRight aria-hidden="true" strokeWidth={1.75} />
                  رجوع
                </Button>
                <Button variant="primary" onClick={() => void submit()} disabled={pending || !password}>
                  {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" strokeWidth={2} />}
                  {pending ? "جارٍ الإرسال…" : "تأكيد وإرسال"}
                </Button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** What signing does (D-122), above the password in both signing dialogs. */
export function SealNotice({ count = 1 }: { count?: number }) {
  return (
    <Alert tone="info" title="يُختم بختم إلكتروني باسمك">
      {count > 1
        ? `يُصدر النظام لكل طلب من الطلبات (${formatNumber(count)}) ختمًا إلكترونيًا برقم فريد، يحفظ اسمك ووقت التوقيع وبصمة محتوى الطلب، ويُطبع على الوثيقة مع رمز تحقق (QR).`
        : "يُصدر النظام ختمًا إلكترونيًا برقم فريد، يحفظ اسمك ووقت التوقيع وبصمة محتوى الطلب، ويُطبع على الوثيقة مع رمز تحقق (QR)."}{" "}
      أدخل كلمة المرور لتأكيد التوقيع.
    </Alert>
  );
}

/**
 * The acceptance criteria (✓ / ✗, a note only when asked for) and «ملاحظة المراجع الفني», shared by
 * the supervisor's evaluation and the unit manager's «تعديل التقييم» (D-120).
 */
export function CriteriaFields({
  answers,
  setAnswers,
  note,
  setNote,
  errors,
}: {
  answers: Answers;
  setAnswers: (update: (all: Answers) => Answers) => void;
  note: string;
  setNote: (v: string) => void;
  errors: Record<string, string | undefined>;
}) {
  return (
    <>
      <ol className="divide-y divide-line rounded-lg border border-line">
        {REVIEW_CRITERIA.map((c, i) => {
          const a = answers[c.key];
          const set = (patch: Partial<Answer>) => setAnswers((all) => ({ ...all, [c.key]: { ...all[c.key], ...patch } }));
          return (
            <li key={c.key} className={cn("px-3.5 py-2.5", a.met === false && "bg-st-bad-soft/30")}>
              <div className="flex items-center gap-3">
                <p className="min-w-0 flex-1 text-[0.9375rem] leading-snug text-ink" title={c.hint}>
                  <span className="t-figure me-1 text-ink-subtle">{toArabicDigits(i + 1)}.</span>
                  {c.title}
                </p>
                <button
                  type="button"
                  onClick={() => set({ noteOpen: !a.noteOpen })}
                  aria-label={`ملاحظة على «${c.title}»`}
                  aria-expanded={a.noteOpen}
                  title="ملاحظة"
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4",
                    a.noteOpen || a.note ? "bg-accent-soft text-accent-ink" : "text-ink-subtle hover:bg-surface-muted hover:text-ink",
                  )}
                >
                  <MessageSquarePlus aria-hidden="true" strokeWidth={1.75} />
                </button>
                <div role="radiogroup" aria-label={c.title} className="flex shrink-0 overflow-hidden rounded-full border border-line-strong">
                  {[
                    { value: true, label: "مستوفى", icon: <Check aria-hidden="true" strokeWidth={2.5} />, on: "bg-st-ok text-white" },
                    { value: false, label: "غير مستوفى", icon: <X aria-hidden="true" strokeWidth={2.5} />, on: "bg-st-bad text-white" },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      role="radio"
                      aria-checked={a.met === o.value}
                      aria-label={o.label}
                      title={o.label}
                      onClick={() => set({ met: o.value })}
                      className={cn(
                        "flex h-8 w-10 items-center justify-center transition-colors focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus [&_svg]:size-4",
                        a.met === o.value ? o.on : "bg-surface text-ink-subtle hover:text-ink",
                      )}
                    >
                      {o.icon}
                    </button>
                  ))}
                </div>
              </div>
              {a.noteOpen ? (
                <input
                  type="text"
                  autoFocus
                  value={a.note}
                  onChange={(e) => set({ note: e.target.value })}
                  maxLength={1000}
                  aria-label={`ملاحظة على «${c.title}»`}
                  placeholder="ملاحظة"
                  className="mt-2 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {errors.criteria ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {errors.criteria}
        </p>
      ) : null}
      <Field id="eval-note" label="ملاحظة المراجع الفني" error={errors.note} className="mt-4">
        <Textarea id="eval-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
    </>
  );
}

/**
 * «تعديل التقييم» (D-120): the unit manager changes the supervisor's criteria and note before
 * deciding. The supervisor's seal stays; the change is recorded with the manager's name.
 */
export function EvaluationEditDialog({ requestId, criteria, note: initialNote }: { requestId: string; criteria: CriterionResult[]; note: string | null }) {
  const router = useRouter();
  const start = () =>
    Object.fromEntries(
      REVIEW_CRITERIA.map((c) => {
        const r = criteria.find((x) => x.key === c.key);
        return [c.key, { met: r ? r.met : null, note: r?.note ?? "", noteOpen: Boolean(r?.note) }];
      }),
    ) as Answers;
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Answers>(start);
  const [note, setNote] = useState(initialNote ?? "");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const complete = REVIEW_CRITERIA.every((c) => answers[c.key].met !== null);

  async function save() {
    setErrors({});
    setMessage(null);
    setPending(true);
    const r = await editEvaluationAction(requestId, { criteria: REVIEW_CRITERIA.map((c) => ({ key: c.key, met: answers[c.key].met === true, note: answers[c.key].note })), note });
    setPending(false);
    if (!r.ok) {
      setErrors(r.errors ?? {});
      setMessage(r.message ?? "تعذّر حفظ التعديل.");
      return;
    }
    setOpen(false);
    toast("عُدّل التقييم", { description: "سُجّل التعديل باسمك في سجل الطلب." });
    router.refresh();
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (pending) return;
        setOpen(v);
        if (v) {
          setAnswers(start());
          setNote(initialNote ?? "");
          setErrors({});
          setMessage(null);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          <PenLine aria-hidden="true" strokeWidth={1.75} />
          تعديل التقييم
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)]" />
        <Dialog.Content className="fixed inset-x-0 top-1/2 z-50 mx-auto flex max-h-[92vh] w-[min(95vw,38rem)] -translate-y-1/2 flex-col overflow-clip rounded-2xl border border-line bg-surface shadow-3 focus:outline-none">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
            <Dialog.Title className="t-section">تعديل التقييم</Dialog.Title>
            <Dialog.Close className="text-ink-subtle hover:text-ink" aria-label="إغلاق" disabled={pending}>
              <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">تعديل معايير القبول والامتثال وملاحظة المراجع الفني قبل القرار.</Dialog.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {message ? (
              <FormError className="mb-3">
                {message}
              </FormError>
            ) : null}
            <CriteriaFields answers={answers} setAnswers={setAnswers} note={note} setNote={setNote} errors={errors} />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3.5">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={pending}>
                إلغاء
              </Button>
            </Dialog.Close>
            <Button variant="primary" onClick={() => void save()} disabled={pending || !complete}>
              {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" strokeWidth={2} />}
              {pending ? "جارٍ الحفظ…" : "حفظ التعديل"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
