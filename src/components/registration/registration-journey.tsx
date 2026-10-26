"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ClipboardList,
  FileBadge,
  HeartHandshake,
  LoaderCircle,
  Quote,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArchOutline, Diamond } from "@/components/brand/arch";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { ProgramIcon } from "@/components/brand/program-icon";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { PASSWORD_MIN } from "@/lib/validation/auth";
import { REGISTRATION_CLASSIFICATIONS, REGISTRATION_FIELD_STEP, SAUDI_REGIONS } from "@/lib/validation/registration";
import { submitRegistrationAction, type RegistrationFormState } from "@/server/actions/registration";
import { RegistrationSuccess } from "./registration-success";

type Program = { number: number; name: string; initiativeCount: number };
type Value = { number: number; title: string; description: string };
type Objective = { number: number; title: string };

const STEPS: { title: string; hint: string; icon: LucideIcon; image: string; alt: string }[] = [
  { title: "مرحبًا بكم", hint: "رحلة الانضمام", icon: Sparkles, image: "/images/haramain/kaaba-tawaf.jpg", alt: "الكعبة المشرفة" },
  { title: "بيانات الجمعية", hint: "الترخيص والموقع والتواصل", icon: Building2, image: "/images/haramain/masjid-al-haram.jpg", alt: "المسجد الحرام" },
  { title: "مجالات العمل", hint: "برامج الرئاسة", icon: ClipboardList, image: "/images/haramain/masjid-an-nabawi.jpg", alt: "المسجد النبوي الشريف" },
  { title: "المسؤول والحساب", hint: "مسؤول الجمعية في المنصة", icon: UserRound, image: "/images/haramain/haram-arches.jpg", alt: "أروقة المسجد الحرام" },
  { title: "القيم والتعهد", hint: "المراجعة والإرسال", icon: HeartHandshake, image: "/images/haramain/kaaba-clock-tower.jpg", alt: "المسجد الحرام والكعبة المشرفة" },
];

export function RegistrationJourney({ vision, programs, values, objectives }: { vision: string | null; programs: Program[]; values: Value[]; objectives: Objective[] }) {
  const { state, onSubmit, pending } = useActionForm<RegistrationFormState>(submitRegistrationAction, {});
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<number[]>([]);
  const [summary, setSummary] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const e = state.errors ?? {};

  const value = (n: number) => values.find((v) => v.number === n);
  const objective = (n: number) => objectives.find((o) => o.number === n);
  const asides: { label: string; text: string | undefined }[] = [
    { label: "رؤية الرئاسة", text: vision ?? undefined },
    { label: `الهدف الاستراتيجي ${toArabicDigits(5)}`, text: objective(5)?.title },
    { label: `الهدف الاستراتيجي ${toArabicDigits(1)}`, text: objective(1)?.title },
    { label: `قيمة ${value(7)?.title ?? "التعاون"}`, text: value(7)?.description },
    { label: `قيمة ${value(1)?.title ?? "تعظيم الحرمين"}`, text: value(1)?.description },
  ];

  // A server error opens the step of the first invalid field.
  useEffect(() => {
    if (!state.errors) return;
    const first = Object.keys(state.errors).map((k) => REGISTRATION_FIELD_STEP[k]).filter((s) => s !== undefined).sort((a, b) => a - b)[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- jump to the step that needs attention
    if (first !== undefined) setStep(first);
  }, [state.errors]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  function stepValid(n: number): boolean {
    const box = formRef.current?.querySelector<HTMLElement>(`[data-step="${n}"]`);
    if (!box) return true;
    for (const el of box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")) {
      if (!el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    if (n === 2 && chosen.length === 0) return false;
    if (n === 3) {
      const form = formRef.current!;
      const pw = (form.elements.namedItem("password") as HTMLInputElement).value;
      const confirm = form.elements.namedItem("confirmPassword") as HTMLInputElement;
      confirm.setCustomValidity(pw === confirm.value ? "" : "كلمتا المرور غير متطابقتين.");
      if (!confirm.checkValidity()) {
        confirm.reportValidity();
        return false;
      }
    }
    return true;
  }

  function next() {
    if (!stepValid(step)) return;
    if (step === 3 && formRef.current) {
      const data = new FormData(formRef.current);
      setSummary(Object.fromEntries([...data.entries()].map(([k, v]) => [k, String(v)])));
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  if (state.ok && state.referenceNo) return <RegistrationSuccess referenceNo={state.referenceNo} vision={vision} />;

  const current = STEPS[step];
  return (
    <div ref={topRef} className="scroll-mt-24">
      <section aria-labelledby="register-title" className="band-scope relative overflow-hidden bg-band text-band-ink">
        <GeometricPattern size={84} />
        <ArchOutline strokeWidth={4} className="absolute -bottom-20 end-10 hidden w-64 text-band-gold/15 md:block" />
        <div className="relative mx-auto max-w-[1360px] px-4 py-10 sm:px-8">
          <p className="flex items-center gap-2 text-sm font-medium text-band-gold">
            <Diamond className="bg-band-gold" />
            الانضمام إلى منظومة خدمة قاصدي الحرمين الشريفين
          </p>
          <h1 id="register-title" className="mt-2 text-[2rem] font-bold leading-snug md:text-[2.375rem]">
            تسجيل جمعية في منصة رفادة
          </h1>
          <p className="mt-2 max-w-2xl text-band-ink-muted">
            خطوات قليلة تفصلكم عن تقديم برامج جمعيتكم ومشروعاتها ضمن برامج الرئاسة، بإشراف فني واضح وإجراءات موثّقة.
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

      <div className="mx-auto grid w-full max-w-[1360px] items-start gap-6 px-4 py-10 sm:px-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[100px]">
          <div className="band-scope relative overflow-hidden rounded-2xl bg-band text-band-ink shadow-2">
            <div key={current.image} className="fade-up relative h-56">
              <Image src={current.image} alt={current.alt} fill sizes="352px" className="object-cover" />
              <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-band via-band/40 to-transparent" />
            </div>
            <div className="relative -mt-10 px-6 pb-6">
              <span className="flex size-14 items-center justify-center rounded-xl border-4 border-band bg-band-gold text-band [&_svg]:size-5">
                <current.icon aria-hidden="true" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-xs font-medium text-band-gold">{asides[step].label}</p>
              {asides[step].text ? (
                <blockquote key={step} className="fade-up mt-2 flex gap-2 text-[0.9375rem] font-semibold leading-[1.9]">
                  <Quote aria-hidden="true" className="mt-1 size-4 shrink-0 -scale-x-100 text-band-gold" />
                  {asides[step].text}
                </blockquote>
              ) : null}
            </div>
          </div>
          <ol className="mt-4 hidden rounded-2xl border border-line bg-surface p-3 shadow-1 lg:block">
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

        <form ref={formRef} onSubmit={onSubmit} noValidate={false} className="min-w-0 rounded-2xl border border-line bg-surface shadow-2">
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
            {state.message && !state.ok ? (
              <Alert tone="danger" className="mb-6">
                {state.message}
              </Alert>
            ) : null}

            {/* Step 0: welcome */}
            <section data-step="0" hidden={step !== 0} className="fade-up">
              <p className="text-lg font-bold leading-relaxed text-ink">أهلًا بجمعيتكم في منصة الإشراف الفني على الجمعيات العاملة في خدمة قاصدي الحرمين الشريفين.</p>
              <p className="mt-2 leading-[1.9] text-ink-muted">
                تنضم جمعيتكم بهذا التسجيل إلى منظومة تعمل في إطار استراتيجية رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي، لتقدّم برامجها
                ومشروعاتها ضمن برامج الرئاسة، وتتابع مراجعتها حتى القرار.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Send, title: "تقديم إلكتروني", text: "برامجكم ومشروعاتكم ضمن برامج الرئاسة ومبادراتها." },
                  { icon: ShieldCheck, title: "إشراف فني واضح", text: "معايير قبول معلنة ومشرف مختص لكل برنامج." },
                  { icon: BadgeCheck, title: "أثر موثّق", text: "إسهام مباشر في إثراء تجربة القاصدين." },
                ].map(({ icon: Icon, title, text }) => (
                  <li key={title} className="rounded-xl border border-line bg-surface-muted p-4">
                    <span className="flex size-10 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
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
                  {["رقم ترخيص الجمعية من المركز الوطني لتنمية القطاع غير الربحي", "بيانات التواصل الرسمية للجمعية", "بيانات مسؤول الجمعية الذي يدير حسابها", "برامج الرئاسة التي تعمل جمعيتكم في مجالها"].map((t) => (
                    <li key={t} className="flex gap-2">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-subtle">يستغرق التسجيل نحو خمس دقائق، وتراجع الوحدة الإشرافية الطلب قبل تفعيل الحساب.</p>
              </div>
            </section>

            {/* Step 1: association */}
            <section data-step="1" hidden={step !== 1} className="fade-up grid gap-5 md:grid-cols-2">
              <Field id="r-name" label="اسم الجمعية كما في الترخيص" error={e.name} required className="md:col-span-2">
                <Input id="r-name" name="name" required minLength={3} maxLength={150} aria-invalid={Boolean(e.name)} />
              </Field>
              <Field id="r-license" label="رقم الترخيص" hint="من شهادة تسجيل المركز الوطني لتنمية القطاع غير الربحي." error={e.licenseNumber} required>
                <Input id="r-license" name="licenseNumber" required inputMode="numeric" dir="ltr" maxLength={10} aria-invalid={Boolean(e.licenseNumber)} />
              </Field>
              <Field id="r-classification" label="تصنيف الجمعية" error={e.classification} required>
                <Select id="r-classification" name="classification" required defaultValue="" placeholder="اختر التصنيف" options={REGISTRATION_CLASSIFICATIONS.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field id="r-region" label="المنطقة" error={e.region} required>
                <Select id="r-region" name="region" required defaultValue="" placeholder="اختر المنطقة" options={SAUDI_REGIONS.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field id="r-city" label="المدينة" error={e.city} required>
                <Input id="r-city" name="city" required minLength={2} maxLength={80} aria-invalid={Boolean(e.city)} />
              </Field>
              <Field id="r-founded" label="سنة التأسيس الهجرية" hint="اختياري، مثل ١٤٣٥." error={e.foundedYear}>
                <Input id="r-founded" name="foundedYear" inputMode="numeric" dir="ltr" maxLength={4} className="w-40" aria-invalid={Boolean(e.foundedYear)} />
              </Field>
              <Field id="r-phone" label="هاتف الجمعية" error={e.contactPhone} required>
                <Input id="r-phone" name="contactPhone" required type="tel" inputMode="tel" dir="ltr" placeholder="05xxxxxxxx" aria-invalid={Boolean(e.contactPhone)} />
              </Field>
              <Field id="r-email" label="البريد الإلكتروني الرسمي" hint="اختياري." error={e.contactEmail}>
                <Input id="r-email" name="contactEmail" type="email" dir="ltr" aria-invalid={Boolean(e.contactEmail)} />
              </Field>
              <Field id="r-website" label="الموقع الإلكتروني" hint="اختياري." error={e.website}>
                <Input id="r-website" name="website" type="url" dir="ltr" placeholder="https://" aria-invalid={Boolean(e.website)} />
              </Field>
            </section>

            {/* Step 2: programmes */}
            <section data-step="2" hidden={step !== 2} className="fade-up">
              <p className="leading-[1.9] text-ink-muted">
                اختاروا برامج الرئاسة التي تعمل جمعيتكم في مجالها. تُقدَّم الطلبات لاحقًا ضمن مبادرات هذه البرامج، ويراجعها مشرف البرنامج المختص.
              </p>
              <fieldset className="mt-5">
                <legend className="sr-only">برامج الرئاسة</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {programs.map((p) => {
                    const on = chosen.includes(p.number);
                    return (
                      <label
                        key={p.number}
                        className={cn(
                          "relative flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-3.5 transition-[border-color,background-color,box-shadow,translate]",
                          "has-[:focus-visible]:outline-3 has-[:focus-visible]:-outline-offset-3 has-[:focus-visible]:outline-focus",
                          on ? "border-primary bg-primary-soft/50 shadow-[inset_0_0_0_1px_var(--primary)]" : "card-link border-line",
                        )}
                      >
                        <input
                          type="checkbox"
                          name="programNumbers"
                          value={p.number}
                          checked={on}
                          onChange={() => setChosen((c) => (on ? c.filter((n) => n !== p.number) : [...c, p.number]))}
                          className="sr-only"
                        />
                        <span aria-hidden="true" className={cn("flex size-11 shrink-0 items-center justify-center rounded-md [&_svg]:size-5", on ? "bg-primary text-primary-ink" : "bg-primary-soft text-primary")}>
                          <ProgramIcon number={p.number} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-accent-ink">البرنامج {toArabicDigits(p.number)}</span>
                          <span className="mt-0.5 block text-sm font-bold leading-snug text-ink">{p.name}</span>
                          <span className="mt-1 block text-xs text-ink-subtle">{formatNumber(p.initiativeCount)} مبادرة</span>
                        </span>
                        <span aria-hidden="true" className={cn("absolute end-3 top-3 flex size-5 items-center justify-center rounded-[5px] border-2", on ? "border-primary bg-primary text-primary-ink" : "border-line-strong")}>
                          {on ? <Check aria-hidden="true" className="size-3.5" strokeWidth={1.75} /> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <p className={cn("mt-4 text-sm", e.programNumbers ? "text-danger" : "text-ink-subtle")} role={e.programNumbers ? "alert" : undefined}>
                {e.programNumbers ?? (chosen.length ? `اخترتم ${formatNumber(chosen.length)} من ${formatNumber(programs.length)} برامج.` : "اختاروا برنامجًا واحدًا على الأقل.")}
              </p>
            </section>

            {/* Step 3: officer and account */}
            <section data-step="3" hidden={step !== 3} className="fade-up">
              <p className="mb-5 leading-[1.9] text-ink-muted">مسؤول الجمعية هو من يقدّم الطلبات ويتابعها ويتواصل مع الوحدة الإشرافية باسم الجمعية.</p>
              <div className="grid gap-5 md:grid-cols-2">
                <Field id="r-officer" label="الاسم الكامل للمسؤول" error={e.officerName} required>
                  <Input id="r-officer" name="officerName" required minLength={2} maxLength={100} autoComplete="name" aria-invalid={Boolean(e.officerName)} />
                </Field>
                <Field id="r-nid" label="رقم الهوية الوطنية أو الإقامة" hint="اختياري؛ يتيح الدخول عبر النفاذ الوطني الموحد." error={e.officerNationalId}>
                  <Input id="r-nid" name="officerNationalId" inputMode="numeric" dir="ltr" maxLength={10} pattern="[12][0-9]{9}" aria-invalid={Boolean(e.officerNationalId)} />
                </Field>
                <Field id="r-ophone" label="جوال المسؤول" error={e.officerPhone} required>
                  <Input id="r-ophone" name="officerPhone" required type="tel" inputMode="tel" dir="ltr" placeholder="05xxxxxxxx" autoComplete="tel" aria-invalid={Boolean(e.officerPhone)} />
                </Field>
                <Field id="r-oemail" label="بريد المسؤول" hint="اختياري؛ لاستعادة كلمة المرور." error={e.officerEmail}>
                  <Input id="r-oemail" name="officerEmail" type="email" dir="ltr" autoComplete="email" aria-invalid={Boolean(e.officerEmail)} />
                </Field>
              </div>
              <div className="mt-7 rounded-xl border border-line bg-surface-muted p-5">
                <p className="flex items-center gap-2 font-bold text-ink">
                  <ShieldCheck aria-hidden="true" className="size-5 text-primary" strokeWidth={1.75} />
                  بيانات الدخول إلى المنصة
                </p>
                <div className="mt-4 grid gap-5 md:grid-cols-2">
                  <Field id="r-username" label="اسم المستخدم" hint="أحرف لاتينية صغيرة وأرقام والرمزان . و _" error={e.username} required className="md:col-span-2">
                    <Input id="r-username" name="username" required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9._]*" dir="ltr" autoComplete="username" className="md:max-w-sm" aria-invalid={Boolean(e.username)} />
                  </Field>
                  <Field id="r-password" label="كلمة المرور" hint={`${toArabicDigits(PASSWORD_MIN)} أحرف على الأقل، منها حرف لاتيني ورقم.`} error={e.password} required>
                    <Input id="r-password" name="password" type="password" required minLength={PASSWORD_MIN} dir="ltr" autoComplete="new-password" aria-invalid={Boolean(e.password)} />
                  </Field>
                  <Field id="r-confirm" label="تأكيد كلمة المرور" error={e.confirmPassword} required>
                    <Input id="r-confirm" name="confirmPassword" type="password" required dir="ltr" autoComplete="new-password" aria-invalid={Boolean(e.confirmPassword)} />
                  </Field>
                </div>
              </div>
            </section>

            {/* Step 4: values, pledge and review */}
            <section data-step="4" hidden={step !== 4} className="fade-up">
              <p className="leading-[1.9] text-ink-muted">تعمل الجمعيات في المنصة وفق قيم الرئاسة في خدمة الحرمين الشريفين وقاصديهما.</p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

              <Summary data={summary} programs={programs.filter((p) => chosen.includes(p.number))} />

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
              <Link href="/login" className="text-sm font-medium text-primary hover:underline">
                لدى جمعيتكم حساب؟ تسجيل الدخول
              </Link>
            )}
            {step < STEPS.length - 1 ? (
              <Button variant={step === 0 ? "gold" : "primary"} size="lg" onClick={next}>
                {step === 0 ? "ابدأ التسجيل" : "التالي"}
                <ArrowLeft aria-hidden="true" />
              </Button>
            ) : (
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                {pending ? "جارٍ إرسال الطلب…" : "إرسال طلب التسجيل"}
              </Button>
            )}
          </footer>
        </form>
      </div>
      <p className="mx-auto max-w-[1360px] px-4 pb-10 text-center text-xs text-ink-subtle sm:px-8">
        تتابعون الطلب بعد إرساله من{" "}
        <Link href="/register/status" className="font-semibold text-primary hover:underline">
          صفحة متابعة طلب التسجيل
        </Link>
        .
      </p>
    </div>
  );
}

function Summary({ data, programs }: { data: Record<string, string>; programs: Program[] }) {
  const rows: [string, string | undefined][] = [
    ["الجمعية", data.name],
    ["رقم الترخيص", data.licenseNumber],
    ["التصنيف", data.classification],
    ["الموقع", [data.city, data.region].filter(Boolean).join("، ")],
    ["هاتف الجمعية", data.contactPhone],
    ["المسؤول", data.officerName],
    ["جوال المسؤول", data.officerPhone],
    ["اسم المستخدم", data.username],
  ];
  return (
    <div className="mt-6 rounded-xl border border-line">
      <p className="border-b border-line px-5 py-3 text-sm font-bold text-ink">مراجعة البيانات قبل الإرسال</p>
      <dl className="grid gap-x-8 gap-y-3 p-5 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-ink-subtle">{k}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink" dir={k === "اسم المستخدم" ? "ltr" : undefined}>{v ? (k === "اسم المستخدم" ? v : toArabicDigits(v)) : "—"}</dd>
          </div>
        ))}
        <div className="sm:col-span-2">
          <dt className="text-xs text-ink-subtle">البرامج</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {programs.map((p) => (
              <span key={p.number} className="rounded-[6px] bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                {p.name}
              </span>
            ))}
          </dd>
        </div>
      </dl>
    </div>
  );
}
