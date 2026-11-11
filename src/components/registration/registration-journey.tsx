"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  FileBadge,
  HeartHandshake,
  Landmark,
  LoaderCircle,
  Lock,
  MapPin,
  Quote,
  Send,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArchOutline, Diamond } from "@/components/brand/arch";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { ImageField } from "@/components/admin/image-field";
import { FileUploader } from "@/components/templates/file-uploader";
import { Button } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { Field, Input } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { FormError } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { cn } from "@/lib/cn";
import { formatNumber, ltr, toArabicDigits } from "@/lib/format";
import { SERVICE_SITES, SERVICE_SITE_KEYS, placeLabels, type ServiceSite } from "@/lib/service-places";
import type { FieldErrors } from "@/lib/validation/auth";
import { LETTER_MAX_MB, OTHER_CLASSIFICATION, REGISTRATION_CLASSIFICATIONS, REGISTRATION_FIELD_STEP } from "@/lib/validation/registration";
import { checkRegistrationStepAction, submitRegistrationAction, type RegistrationFormState } from "@/server/actions/registration";
import { RegistrationSuccess } from "./registration-success";
import { VisionWheel } from "./vision-wheel";

type Value = { number: number; title: string; description: string };
type Objective = { number: number; title: string };

/** What the super admin entered; shown to the association and not editable (D-149). */
export type InviteData = {
  name: string;
  licenseNumber: string;
  contactEmail: string;
  website: string | null;
  officerName: string;
  secondOfficerName: string | null;
  createdAt: string;
  expiresAt: string;
};

const STEPS: { title: string; hint: string; icon: LucideIcon; image: string; alt: string }[] = [
  { title: "مرحبًا بكم", hint: "رحلة الانضمام", icon: Sparkles, image: "/images/haramain/kaaba-tawaf-dark.jpg", alt: "الكعبة المشرفة" },
  { title: "بيانات الجمعية", hint: "التصنيف والتواصل", icon: Building2, image: "/images/haramain/masjid-al-haram.jpg", alt: "المسجد الحرام" },
  { title: "مكان تقديم الخدمة", hint: "المسجد الحرام أو المسجد النبوي", icon: MapPin, image: "/images/haramain/masjid-an-nabawi.jpg", alt: "المسجد النبوي" },
  { title: "المسؤولان", hint: "وسائل التواصل معهما", icon: UsersRound, image: "/images/haramain/haram-arches.jpg", alt: "أروقة المسجد الحرام" },
  { title: "الخطاب والتعهد", hint: "المراجعة والإرسال", icon: HeartHandshake, image: "/images/haramain/kaaba-clock-tower.jpg", alt: "المسجد الحرام والكعبة المشرفة" },
];

/**
 * The association's registration form, opened from the link the super admin issued (D-149). The
 * super admin's fields are shown locked; the association completes the rest, chooses where it
 * serves, attaches the letter and sends. The link stops working once the form is sent.
 */
export function RegistrationJourney({
  token,
  invite,
  vision,
  values,
  objectives,
}: {
  token: string;
  invite: InviteData;
  vision: string | null;
  values: Value[];
  objectives: Objective[];
}) {
  const { state, onSubmit, pending } = useActionForm<RegistrationFormState>(submitRegistrationAction.bind(null, token), {});
  const [step, setStep] = useState(0);
  const [site, setSite] = useState<ServiceSite | "">("");
  const [places, setPlaces] = useState<string[]>([]);
  const [classification, setClassification] = useState("");
  const [summary, setSummary] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  // Field errors shown in the form: from checking a step on «التالي», or from the submission. A
  // field's error clears as soon as it is edited.
  const [errors, setErrors] = useState<FieldErrors>({});
  const [checking, setChecking] = useState(false);
  const [failedChecks, setFailedChecks] = useState(0);
  const e = errors;

  const value = (n: number) => values.find((v) => v.number === n);
  const objective = (n: number) => objectives.find((o) => o.number === n);
  const asides: { label: string; text: string | undefined }[] = [
    { label: "رؤية الرئاسة", text: vision ?? undefined },
    { label: `الهدف الاستراتيجي ${toArabicDigits(5)}`, text: objective(5)?.title },
    { label: `قيمة ${value(1)?.title ?? "تعظيم الحرمين"}`, text: value(1)?.description },
    { label: `قيمة ${value(7)?.title ?? "التعاون"}`, text: value(7)?.description },
    { label: "رؤية الرئاسة", text: vision ?? undefined },
  ];

  // A server error opens the step of the first invalid field.
  useEffect(() => {
    if (!state.errors) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the submission's field errors
    setErrors(state.errors);
    const first = Object.keys(state.errors).map((k) => REGISTRATION_FIELD_STEP[k]).filter((s) => s !== undefined).sort((a, b) => a - b)[0];
    if (first !== undefined) setStep(first);
  }, [state.errors]);

  // After a failed check (not while errors clear during editing), bring the first field to fix
  // into view and put the cursor in it.
  useEffect(() => {
    if (failedChecks === 0) return;
    const box = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const target = box?.querySelector<HTMLElement>('[aria-invalid="true"], [data-error="true"]');
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per failed check only
  }, [failedChecks]);

  // Changing step keeps the page where it is, so the form and the wheel stay in view; it scrolls
  // only when the top of the form has gone under the header.
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const form = formRef.current;
    if (form && form.getBoundingClientRect().top < 100) form.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  async function next() {
    const form = formRef.current;
    if (!form) return;
    // Steps 1 to 3 are checked against the submission's own rules before the next step opens, so
    // nothing is left to fix at the end.
    if (step >= 1 && step <= 3) {
      setChecking(true);
      const result = await checkRegistrationStepAction(token, step, new FormData(form)).catch(() => ({ ok: false, errors: { form: "تعذّر التحقق من البيانات. حاولوا مرة أخرى." } }));
      setChecking(false);
      if (!result.ok) {
        setErrors(result.errors ?? {});
        setFailedChecks((n) => n + 1);
        return;
      }
    }
    setErrors({});
    if (step === 3) {
      const data = new FormData(form);
      setSummary(Object.fromEntries([...data.entries()].filter(([k]) => k !== "servicePlaces").map(([k, v]) => [k, String(v)])));
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function clearError(name: string) {
    if (!(name in errors) && !("form" in errors)) return;
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== name && k !== "form")));
  }

  function togglePlace(key: string, on: boolean) {
    setPlaces((prev) => (on ? [...prev, key] : prev.filter((k) => k !== key)));
    clearError("servicePlaces");
  }

  if (state.ok && state.referenceNo) return <RegistrationSuccess referenceNo={state.referenceNo} vision={vision} />;

  const current = STEPS[step];
  const sitePlaces = site ? SERVICE_SITES[site].places : [];
  return (
    <div>
      <section aria-labelledby="register-title" className="band-scope relative overflow-hidden bg-band text-band-ink">
        <GeometricPattern size={84} />
        <ArchOutline strokeWidth={4} className="absolute -bottom-20 end-10 hidden w-64 text-band-gold/15 md:block" />
        <div className="relative mx-auto max-w-[1360px] px-4 py-10 sm:px-8">
          <p className="flex items-center gap-2 text-sm font-medium text-band-gold">
            <Diamond className="bg-band-gold" />
            الانضمام إلى منظومة خدمة قاصدي الحرمين الشريفين
          </p>
          <h1 id="register-title" className="mt-2 text-[2rem] font-bold leading-snug md:text-[2.375rem]">
            تسجيل {invite.name}
          </h1>
          <p className="mt-2 max-w-2xl text-band-ink-muted">
            أضافت الوحدة الإشرافية جمعيتكم إلى المنصة. استكملوا بياناتها وأرفقوا الخطاب لتُراجَع ويُفعَّل حسابها.
          </p>
          <p className="mt-3 inline-flex flex-wrap items-center gap-x-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-sm text-band-ink-muted">
            يبقى الرابط صالحًا حتى <DateDisplay date={new Date(invite.expiresAt)} className="font-semibold text-band-ink" />، ويُستعمل مرة واحدة.
          </p>
          <ol aria-label="مراحل التسجيل" className="mt-8 grid grid-cols-5 gap-2">
            {STEPS.map((s, i) => (
              <li key={s.title} aria-current={i === step ? "step" : undefined} className="min-w-0">
                <span className={cn("block h-1.5 rounded-full transition-colors", i < step ? "bg-band-gold" : i === step ? "bg-band-gold/70" : "bg-white/15")} />
                <span className={cn("mt-2 hidden truncate text-xs sm:block", i === step ? "font-bold text-band-ink" : "text-band-ink-muted")}>
                  {toArabicDigits(i + 1)}. {s.title}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* From xl the step list sits against the start edge with the form beside it, and the vision wheel turns at
          the end edge of the screen; below xl a compact card carries the same photo and quote. */}
      <div className="wheel-scope relative">
        <VisionWheel slides={STEPS.map((s, i) => ({ ...s, label: asides[i].label, text: asides[i].text }))} active={step} />
        <div className="relative mx-auto grid w-full max-w-[1360px] items-start gap-6 px-4 py-10 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] xl:w-auto xl:max-w-none xl:ms-0 xl:me-[calc(var(--wheel)+3rem)]">
          <aside className="lg:sticky lg:top-[100px]">
            <div className="band-scope relative overflow-hidden rounded-2xl bg-band text-band-ink shadow-2 xl:hidden">
              <div key={current.image} className="fade-up relative h-40">
                <Image src={current.image} alt={current.alt} fill sizes="(min-width: 1024px) 272px, 100vw" className="object-cover" />
                <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-band via-band/40 to-transparent" />
              </div>
              <div className="relative -mt-8 flex flex-col items-center px-5 pb-5 text-center">
                <span className="flex size-12 items-center justify-center rounded-full border-4 border-band bg-band-gold text-band [&_svg]:size-5">
                  <current.icon aria-hidden="true" strokeWidth={1.75} />
                </span>
                <p className="mt-3 text-xs font-medium text-band-gold">{asides[step].label}</p>
                {asides[step].text ? (
                  <blockquote key={step} className="fade-up mt-2 text-[0.9375rem] font-semibold leading-[1.9]">
                    <Quote aria-hidden="true" className="mx-auto size-4 -scale-x-100 text-band-gold" />
                    {asides[step].text}
                  </blockquote>
                ) : null}
              </div>
            </div>
            <ol className="mt-4 hidden rounded-2xl border border-line bg-surface p-3 shadow-1 lg:block xl:mt-0">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <button
                    type="button"
                    disabled={i > step}
                    onClick={() => i < step && setStep(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors",
                      i === step ? "bg-primary-soft/60" : i < step ? "hover:bg-surface-muted" : "cursor-default opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "t-figure flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                        i < step ? "border-primary bg-primary text-primary-ink" : i === step ? "border-accent bg-accent-soft text-accent-ink" : "border-line-strong text-ink-subtle",
                      )}
                    >
                      {i < step ? <Check aria-hidden="true" className="size-4" strokeWidth={1.75} /> : toArabicDigits(i + 1)}
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block text-sm", i === step ? "font-bold text-ink" : "text-ink-muted")}>{s.title}</span>
                      <span className="block truncate text-xs text-ink-subtle">{s.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          <form ref={formRef} onSubmit={onSubmit} onChange={(ev) => clearError((ev.target as EventTarget as HTMLInputElement).name)} noValidate={false} className="min-w-0 scroll-mt-28 rounded-2xl border border-line bg-surface shadow-2">
            <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="website_confirm">اترك هذا الحقل فارغًا</label>
              <input id="website_confirm" name="website_confirm" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
            </div>

            <header className="flex items-end gap-3 border-b border-line px-6 py-5 sm:px-8">
              <span aria-hidden="true" className="mb-[11px] size-2 shrink-0 rotate-45 bg-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-accent-ink">
                  الخطوة {toArabicDigits(step + 1)} من {toArabicDigits(STEPS.length)}
                </p>
                <h2 className="text-xl font-bold text-brand-ink">{current.title}</h2>
              </div>
            </header>

            <div className="px-6 py-7 sm:px-8">
              {stepErrorCount(errors, step) > 0 || errors.form ? (
                <FormError className="mb-6">
                  {errors.form ??
                    (stepErrorCount(errors, step) === 1
                      ? "يوجد حقل يحتاج إلى تصحيح في هذه الخطوة. صحّحوه ثم تابعوا."
                      : `توجد ${formatNumber(stepErrorCount(errors, step))} حقول تحتاج إلى تصحيح في هذه الخطوة. صحّحوها ثم تابعوا.`)}
                </FormError>
              ) : null}
              {state.message && !state.ok ? <FormError className="mb-6">{state.message}</FormError> : null}

              {/* Step 0: welcome */}
              <section data-step="0" hidden={step !== 0} className="fade-up">
                <p className="text-lg font-bold leading-relaxed text-ink">أهلًا بجمعيتكم في منصة الإشراف الفني على الجمعيات العاملة في خدمة قاصدي الحرمين الشريفين.</p>
                <p className="mt-2 leading-[1.9] text-ink-muted">
                  تنضم جمعيتكم بهذا التسجيل إلى منظومة تعمل في إطار استراتيجية رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي، لتقدّم برامجها
                  ومشروعاتها ضمن مسارات الرئاسة، وتتابع مراجعتها حتى القرار.
                </p>
                <ul className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                  {[
                    { icon: Send, title: "تقديم إلكتروني", text: "برامجكم ومشروعاتكم ضمن مسارات الرئاسة وبرامجها." },
                    { icon: ShieldCheck, title: "إشراف فني واضح", text: "معايير قبول معلنة ومشرف مختص لكل مسار." },
                    { icon: BadgeCheck, title: "أثر موثّق", text: "إسهام مباشر في إثراء تجربة القاصدين." },
                  ].map(({ icon: Icon, title, text }) => (
                    <li key={title} className="flex flex-col items-center rounded-xl border border-line bg-surface-muted p-4 text-center">
                      <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                        <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                      </span>
                      <p className="mt-3 font-bold text-ink">{title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-xl border border-primary/25 bg-primary-soft/40 p-5">
                  <p className="flex items-center gap-2 font-bold text-brand-ink">
                    <FileBadge aria-hidden="true" className="size-5 text-primary" strokeWidth={1.75} />
                    جهّزوا قبل البدء
                  </p>
                  <ul className="mt-3 grid gap-2 text-sm text-ink-muted sm:grid-cols-2">
                    {[`الخطاب بصيغة ${ltr("PDF")}`, "رقم هاتف الجمعية وجوال المسؤولَين", "أماكن تقديم الخدمة في المسجد الحرام أو المسجد النبوي", "شعار الجمعية إن وُجد"].map((t) => (
                      <li key={t} className="flex gap-2">
                        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
                        {t}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-ink-subtle">
                    يستغرق التسجيل نحو خمس دقائق، وتراجع الوحدة الإشرافية الطلب قبل تفعيل الحساب. بعد الاعتماد تدخلون بالبريد الإلكتروني للجمعية وكلمة مرور مؤقتة
                    تُغيّرونها عند أول دخول.
                  </p>
                </div>
              </section>

              {/* Step 1: association */}
              <section data-step="1" hidden={step !== 1} className="fade-up grid gap-5 md:grid-cols-2">
                <Locked
                  className="md:col-span-2"
                  rows={[
                    ["اسم الجمعية", invite.name],
                    ["رقم الترخيص", toArabicDigits(invite.licenseNumber)],
                    ["البريد الإلكتروني", invite.contactEmail, true],
                    ...(invite.website ? ([["الموقع الإلكتروني", invite.website, true]] as LockedRow[]) : []),
                    ["تاريخ الإنشاء", <DateDisplay key="created" date={new Date(invite.createdAt)} />],
                  ]}
                  note="البريد الإلكتروني هو اسم الدخول إلى حساب الجمعية بعد اعتمادها."
                />
                <div className="md:col-span-2">
                  <input id="r-name" type="hidden" value={invite.name} readOnly />
                  <ImageField
                    label="شعار الجمعية"
                    shape="square"
                    layout="tile"
                    nameFieldId="r-name"
                    defaultName={invite.name}
                    uploadUrl={`/api/registration/logo?t=${encodeURIComponent(token)}`}
                    note="اختياري؛ يظهر في ملف الجمعية بعد اعتمادها."
                    error={e.image}
                  />
                </div>
                <Field id="r-classification" label="تصنيف الجمعية" error={e.classification} required>
                  <SearchSelect
                    id="r-classification"
                    name="classification"
                    placeholder="يُرجى اختيار التصنيف"
                    searchPlaceholder="ابحث…"
                    aria-invalid={Boolean(e.classification)}
                    onValueChange={(v) => {
                      setClassification(v);
                      clearError("classification");
                      clearError("classificationOther");
                    }}
                    options={REGISTRATION_CLASSIFICATIONS.map((c) => ({ value: c, label: c }))}
                  />
                </Field>
                {classification === OTHER_CLASSIFICATION ? (
                  <Field id="r-classification-other" label="اكتبوا تصنيف الجمعية" hint="كما يرد في ترخيص الجمعية أو نظامها." error={e.classificationOther} required className="fade-up md:col-span-2">
                    <Input id="r-classification-other" name="classificationOther" required maxLength={150} autoFocus placeholder="مثال: منظمات رعاية كبار السن من القاصدين" aria-invalid={Boolean(e.classificationOther)} />
                  </Field>
                ) : null}
                <Field id="r-founded" label="سنة التأسيس الهجرية" hint="اختياري، مثل ١٤٣٥." error={e.foundedYear}>
                  <Input id="r-founded" name="foundedYear" inputMode="numeric" dir="ltr" maxLength={4} className="w-40" aria-invalid={Boolean(e.foundedYear)} />
                </Field>
                <Field id="r-phone" label="هاتف الجمعية" error={e.contactPhone} required>
                  <Input id="r-phone" name="contactPhone" required type="tel" inputMode="tel" dir="ltr" placeholder="05xxxxxxxx" aria-invalid={Boolean(e.contactPhone)} />
                </Field>
                {invite.website ? null : (
                  <Field id="r-website" label="الموقع الإلكتروني" hint="اختياري." error={e.website}>
                    <Input id="r-website" name="website" type="url" dir="ltr" placeholder="https://" aria-invalid={Boolean(e.website)} />
                  </Field>
                )}
              </section>

              {/* Step 2: where the association serves (D-149) */}
              <section data-step="2" hidden={step !== 2} className="fade-up">
                <p className="mb-5 leading-[1.9] text-ink-muted">
                  يقتصر النطاق الإشرافي للرئاسة على الشؤون الدينية داخل المسجد الحرام والمسجد النبوي. اختاروا موقع تقديم خدمات الجمعية، ثم الأماكن التي تعمل فيها.
                </p>
                <fieldset aria-describedby={e.serviceSite ? "site-error" : undefined}>
                  <legend className="text-sm font-medium text-ink">
                    موقع تقديم الخدمة
                    <span className="ms-1 text-danger" aria-hidden="true">
                      *
                    </span>
                  </legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2" data-error={e.serviceSite ? "true" : undefined} tabIndex={e.serviceSite ? -1 : undefined}>
                    {SERVICE_SITE_KEYS.map((key) => {
                      const s = SERVICE_SITES[key];
                      const checked = site === key;
                      return (
                        <label
                          key={key}
                          className={cn(
                            "flex cursor-pointer items-center gap-3.5 rounded-xl border-2 p-4 transition-colors",
                            checked ? "border-primary bg-primary-soft/50" : e.serviceSite ? "border-danger" : "border-line hover:bg-surface-muted",
                          )}
                        >
                          <input
                            type="radio"
                            name="serviceSite"
                            value={key}
                            checked={checked}
                            onChange={() => {
                              setSite(key);
                              setPlaces([]);
                              clearError("serviceSite");
                              clearError("servicePlaces");
                            }}
                            className="size-4 shrink-0 accent-[var(--primary)]"
                          />
                          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", checked ? "bg-primary text-primary-ink" : "bg-accent-soft text-accent-ink")}>
                            <Landmark aria-hidden="true" className="size-5" strokeWidth={1.75} />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-bold text-brand-ink">{s.city}</span>
                            <span className="block text-sm text-ink-muted">{s.mosque}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {e.serviceSite ? (
                    <p id="site-error" role="alert" className="mt-2 text-xs text-danger">
                      {e.serviceSite}
                    </p>
                  ) : null}
                </fieldset>

                {site ? (
                  <fieldset key={site} className="fade-up mt-6 rounded-xl border border-line" aria-describedby={e.servicePlaces ? "places-error" : undefined}>
                    <legend className="ms-4 px-1.5 text-sm font-medium text-ink">
                      أماكن تقديم الخدمة في {SERVICE_SITES[site].mosque}
                      <span className="ms-1 text-danger" aria-hidden="true">
                        *
                      </span>
                    </legend>
                    <div className="grid gap-2 p-4 pt-2 sm:grid-cols-2" data-error={e.servicePlaces ? "true" : undefined} tabIndex={e.servicePlaces ? -1 : undefined}>
                      {sitePlaces.map((p) => {
                        const on = places.includes(p.key);
                        return (
                          <label
                            key={p.key}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors",
                              on ? "border-primary bg-primary-soft/40 font-semibold text-ink" : "border-line text-ink-muted hover:bg-surface-muted",
                            )}
                          >
                            <input type="checkbox" name="servicePlaces" value={p.key} checked={on} onChange={(ev) => togglePlace(p.key, ev.target.checked)} className="size-4 shrink-0 accent-[var(--primary)]" />
                            {p.label}
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
                      <span className="t-caption">
                        اختيرت {formatNumber(places.length)} من {formatNumber(sitePlaces.length)}
                      </span>
                      <button
                        type="button"
                        className="text-sm font-medium text-primary hover:underline"
                        onClick={() => {
                          setPlaces(places.length === sitePlaces.length ? [] : sitePlaces.map((p) => p.key));
                          clearError("servicePlaces");
                        }}
                      >
                        {places.length === sitePlaces.length ? "إلغاء اختيار الكل" : "اختيار الكل"}
                      </button>
                    </div>
                    {e.servicePlaces ? (
                      <p id="places-error" role="alert" className="px-4 pb-3 text-xs text-danger">
                        {e.servicePlaces}
                      </p>
                    ) : null}
                  </fieldset>
                ) : (
                  <p className="mt-6 rounded-xl border border-line bg-surface-muted px-5 py-4 text-sm text-ink-muted">تظهر أماكن تقديم الخدمة بعد اختيار الموقع.</p>
                )}
              </section>

              {/* Step 3: the two officers */}
              <section data-step="3" hidden={step !== 3} className="fade-up">
                <p className="mb-5 leading-[1.9] text-ink-muted">سجّلت الوحدة الإشرافية مسؤولَي الجمعية. أضيفوا رقم الجوال للتواصل معهما.</p>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="flex flex-col gap-4 rounded-xl border border-line p-5">
                    <Locked rows={[["المسؤول الأول", invite.officerName]]} />
                    <Field id="r-ophone" label="جوال المسؤول الأول" error={e.officerPhone} required>
                      <Input id="r-ophone" name="officerPhone" required type="tel" inputMode="tel" dir="ltr" placeholder="05xxxxxxxx" autoComplete="tel" aria-invalid={Boolean(e.officerPhone)} />
                    </Field>
                  </div>
                  <div className="flex flex-col gap-4 rounded-xl border border-line p-5">
                    <Locked rows={[["المسؤول الثاني", invite.secondOfficerName ?? "—"]]} />
                    <Field id="r-o2phone" label="جوال المسؤول الثاني" hint="اختياري." error={e.secondOfficerPhone}>
                      <Input id="r-o2phone" name="secondOfficerPhone" type="tel" inputMode="tel" dir="ltr" placeholder="05xxxxxxxx" aria-invalid={Boolean(e.secondOfficerPhone)} />
                    </Field>
                  </div>
                </div>
                <div className="mt-6 flex gap-3 rounded-xl border border-line bg-surface-muted p-5 text-sm leading-[1.9] text-ink-muted">
                  <ShieldCheck aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" strokeWidth={1.75} />
                  <p>
                    يُنشأ للجمعية حساب واحد، اسم الدخول فيه البريد الإلكتروني{" "}
                    <bdi dir="ltr" className="font-semibold text-ink">
                      {invite.contactEmail}
                    </bdi>
                    ، وتصلكم كلمة المرور المؤقتة بعد اعتماد الطلب.
                  </p>
                </div>
              </section>

              {/* Step 4: letter, values, pledge and review */}
              <section data-step="4" hidden={step !== 4} className="fade-up">
                <div data-error={e.letter ? "true" : undefined} tabIndex={e.letter ? -1 : undefined}>
                  <FileUploader
                    label="الخطاب"
                    accept=".pdf,application/pdf"
                    maxMb={LETTER_MAX_MB}
                    endpoint={`/api/registration/letter?t=${encodeURIComponent(token)}`}
                    inputName="letter.uploadId"
                    types={`ملف ${ltr("PDF")} فقط`}
                    error={e.letter}
                  />
                </div>

                <p className="mt-7 leading-[1.9] text-ink-muted">تعمل الجمعيات في المنصة وفق قيم الرئاسة في خدمة الحرمين الشريفين وقاصديهما.</p>
                <ul className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {values.map((v) => (
                    <li key={v.number} className="flex gap-3 rounded-lg border border-line bg-surface-muted p-3.5">
                      <span aria-hidden="true" className="relative flex size-9 shrink-0 items-center justify-center">
                        <span className="absolute inset-1 rotate-45 rounded-[5px] border border-accent/50 bg-accent-soft" />
                        <span className="t-figure relative text-sm text-accent-ink">{toArabicDigits(v.number)}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-brand-ink">{v.title}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{v.description}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                <Summary data={summary} invite={invite} site={site} places={places} />

                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border-2 border-accent/40 bg-accent-soft/60 p-5">
                  <input type="checkbox" name="pledge" required className="mt-1 size-5 shrink-0 accent-[var(--primary)]" aria-invalid={Boolean(e.pledge)} />
                  <span className="text-sm leading-[1.9] text-ink">
                    <span className="block font-bold">التعهد</span>
                    نتعهد بالالتزام بقيم رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي وأنظمة العمل في الحرمين الشريفين، وبأن البيانات المقدّمة صحيحة
                    وتخص جمعيتنا، وبأن نقدّم برامجنا ومشروعاتنا بما يليق بقدسية المكان ومكانة الحرمين الشريفين.
                    {e.pledge ? (
                      <span className="mt-1 block text-danger" role="alert">
                        {e.pledge}
                      </span>
                    ) : null}
                  </span>
                </label>
              </section>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-line bg-surface-muted px-6 py-4 sm:px-8">
              {step > 0 ? (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  <ArrowRight aria-hidden="true" />
                  السابق
                </Button>
              ) : (
                <span />
              )}
              {/* Separate keys: if React reused the "next" button as the submit button, the click that
                  opens the last step would also submit the form, and the browser would jump down to
                  the unticked pledge to report it. */}
              {step < STEPS.length - 1 ? (
                <Button key="next" variant={step === 0 ? "gold" : "primary"} size="lg" onClick={next} disabled={checking}>
                  {checking ? "جارٍ التحقق…" : step === 0 ? "ابدأ التسجيل" : "التالي"}
                  {checking ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}
                </Button>
              ) : (
                <Button key="submit" type="submit" size="lg" disabled={pending}>
                  {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                  {pending ? "جارٍ إرسال الطلب…" : "إرسال طلب التسجيل"}
                </Button>
              )}
            </footer>
          </form>
        </div>
      </div>
      <p className="mx-auto max-w-[1360px] px-4 pb-10 text-center text-xs text-ink-subtle sm:px-8">
        تتابعون الطلب بعد إرساله برقم الطلب ورقم الترخيص من{" "}
        <Link href="/register/status" className="font-semibold text-primary hover:underline">
          صفحة متابعة طلب التسجيل
        </Link>
        .
      </p>
    </div>
  );
}

type LockedRow = [label: string, value: ReactNode, ltr?: boolean];

/** Fields the super admin entered: shown, not editable. */
function Locked({ rows, note, className }: { rows: LockedRow[]; note?: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface-muted px-5 py-4", className)}>
      <p className="mb-3 flex items-center gap-2 text-xs font-medium text-ink-subtle">
        <Lock aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
        أدخلتها الوحدة الإشرافية
      </p>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, v, isLtr]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-ink-subtle">{label}</dt>
            <dd className="mt-0.5 break-words text-sm font-semibold text-ink">{isLtr ? <bdi dir="ltr">{v}</bdi> : v}</dd>
          </div>
        ))}
      </dl>
      {note ? <p className="t-caption mt-3">{note}</p> : null}
    </div>
  );
}

function Summary({ data, invite, site, places }: { data: Record<string, string>; invite: InviteData; site: ServiceSite | ""; places: string[] }) {
  const rows: [string, string | null | undefined, boolean?][] = [
    ["الجمعية", invite.name],
    ["رقم الترخيص", toArabicDigits(invite.licenseNumber)],
    ["البريد الإلكتروني (اسم الدخول)", invite.contactEmail, true],
    ["التصنيف", data.classification === OTHER_CLASSIFICATION ? data.classificationOther : data.classification],
    ["هاتف الجمعية", data.contactPhone, true],
    ["موقع تقديم الخدمة", site ? `${SERVICE_SITES[site].mosque} — ${SERVICE_SITES[site].city}` : null],
    ["المسؤول الأول", invite.officerName],
    ["جوال المسؤول الأول", data.officerPhone, true],
    ["المسؤول الثاني", invite.secondOfficerName],
    ["جوال المسؤول الثاني", data.secondOfficerPhone, true],
  ];
  const placeNames = site ? placeLabels(site, places) : [];
  return (
    <div className="mt-6 rounded-xl border border-line">
      <p className="border-b border-line px-5 py-3 text-sm font-bold text-ink">مراجعة البيانات قبل الإرسال</p>
      <dl className="grid gap-x-8 gap-y-3 p-5 sm:grid-cols-2">
        {rows.map(([k, v, isLtr]) => (
          <div key={k}>
            <dt className="text-xs text-ink-subtle">{k}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{v ? isLtr ? <bdi dir="ltr">{v}</bdi> : v : "—"}</dd>
          </div>
        ))}
        <div className="sm:col-span-2">
          <dt className="text-xs text-ink-subtle">أماكن تقديم الخدمة</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {placeNames.length > 0
              ? placeNames.map((p) => (
                  <span key={p} className="rounded-md border border-line bg-surface-muted px-2 py-0.5 text-sm text-ink">
                    {p}
                  </span>
                ))
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** How many of the errors belong to the fields of a step. */
function stepErrorCount(errors: FieldErrors, step: number): number {
  return Object.keys(errors).filter((k) => REGISTRATION_FIELD_STEP[k] === step).length;
}
