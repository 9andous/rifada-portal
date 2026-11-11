"use client";

import Link from "next/link";
import {
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Globe,
  Hash,
  KeyRound,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Send,
  Settings2,
  Timer,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { Alert, FormError } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { cn } from "@/lib/cn";
import { formatNumber, ltr, toArabicDigits } from "@/lib/format";
import type { InviteFormState } from "@/server/actions/registration";
import { InviteLink } from "./invite-link";

type Props = { action: (state: InviteFormState, formData: FormData) => Promise<InviteFormState>; hours: number; today: string };

/**
 * «جمعية جديدة» (D-149): the super admin enters six fields; the creation date is the system's. Saving
 * issues the association's registration link, shown here and kept on the registration's page. The
 * form sits beside a guide to what happens next, so the page uses the full width.
 */
export function InviteForm({ action, hours, today }: Props) {
  const { state, onSubmit, pending } = useActionForm<InviteFormState>(action, {});
  const e = state.errors ?? {};
  const done = Boolean(state.ok && state.invite);

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      {done && state.invite ? (
        <section className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6 shadow-1 sm:p-8">
          <Alert tone="success" title="أُنشئ رابط تسجيل الجمعية">
            أرسل الرابط إلى الجمعية لتستكمل بياناتها وترفق الخطاب. يتعطل بانتهاء صلاحيته أو بعد إرسال الجمعية بياناتها، ويبقى في صفحة الطلب لنسخه أو تعديل مدته.
          </Alert>
          <InviteLink token={state.invite.token} expiresAt={state.invite.expiresAt} />
          <div className="flex flex-wrap gap-3">
            {state.createdId ? (
              <Link href={`/admin/registrations/${state.createdId}`} className={buttonClasses("primary")}>
                <ClipboardList aria-hidden="true" strokeWidth={1.75} />
                فتح صفحة الطلب
              </Link>
            ) : null}
            <Button variant="outline" onClick={() => window.location.reload()}>
              <Plus aria-hidden="true" strokeWidth={1.75} />
              إضافة جمعية أخرى
            </Button>
            <Link href="/admin/registrations?status=INVITED" className={buttonClasses("ghost")}>
              الروابط بانتظار الجمعيات
            </Link>
          </div>
        </section>
      ) : (
        <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-6" noValidate>
          {state.message && !state.ok ? <FormError>{state.message}</FormError> : null}

          <Section number={1} icon={Building2} title="بيانات الجمعية" description="كما في ترخيص الجمعية. تظهر للجمعية في رابط التسجيل ولا تستطيع تعديلها.">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
              <TextField
                className="lg:col-span-2"
                name="name"
                label="اسم الجمعية"
                icon={Building2}
                required
                placeholder="مثال: جمعية هدية الحاج والمعتمر الخيرية"
                error={e.name}
              />
              <TextField name="licenseNumber" label="رقم الترخيص" icon={Hash} required ltr inputMode="numeric" placeholder="مثال: 1234" hint="من شهادة تسجيل المركز الوطني لتنمية القطاع غير الربحي؛ لا يتكرر." error={e.licenseNumber} />
              <TextField name="contactEmail" label="البريد الإلكتروني" icon={Mail} required ltr type="email" inputMode="email" placeholder="info@example.org" hint="اسم الدخول إلى حساب الجمعية بعد اعتمادها؛ لا يتكرر في المنصة." error={e.contactEmail} />
              <TextField className="lg:col-span-2" name="website" label="موقع الويب" icon={Globe} ltr type="url" inputMode="url" placeholder="https://" hint="إن تُرك فارغًا تستطيع الجمعية إضافته." error={e.website} />
            </div>
          </Section>

          <Section number={2} icon={UsersRound} title="مسؤولا الجمعية" description="الاسم الكامل لكل منهما. تضيف الجمعية رقم الجوال لكل مسؤول.">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <OfficerCard order="الأول" caption="يدخل بحساب الجمعية بعد اعتمادها." accent>
                <TextField name="officerName" label="الاسم الكامل" icon={UserRound} required error={e.officerName} />
              </OfficerCard>
              <OfficerCard order="الثاني" caption="للتواصل والتنظيم في شؤون الجمعية.">
                <TextField name="secondOfficerName" label="الاسم الكامل" icon={UserRound} required error={e.secondOfficerName} />
              </OfficerCard>
            </div>
          </Section>

          <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-1 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-lg bg-surface-muted text-ink-subtle">
                  <CalendarClock className="size-4" strokeWidth={1.75} />
                </span>
                <div>
                  <dt className="text-xs text-ink-subtle">تاريخ الإنشاء (تلقائي)</dt>
                  <dd className="font-semibold text-ink">
                    <DateDisplay date={new Date(today)} dateOnly />
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-lg bg-surface-muted text-ink-subtle">
                  <Timer className="size-4" strokeWidth={1.75} />
                </span>
                <div>
                  <dt className="text-xs text-ink-subtle">صلاحية الرابط</dt>
                  <dd className="font-semibold text-ink">{formatNumber(hours)} ساعة</dd>
                </div>
              </div>
            </dl>
            <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
              <SubmitButton pending={pending} pendingLabel="جارٍ الإنشاء…">
                <Link2 aria-hidden="true" strokeWidth={1.75} />
                تأكيد وإنشاء الرابط
              </SubmitButton>
              <p className="t-caption text-center sm:text-end">
                الحقول المعلَّمة بـ<span className="text-danger">*</span> مطلوبة.
              </p>
            </div>
          </div>
        </form>
      )}

      <Guide hours={hours} />
    </div>
  );
}

/** A numbered card of the form. */
function Section({ number, icon: Icon, title, description, children }: { number: number; icon: LucideIcon; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`invite-section-${number}`} className="rounded-xl border border-line bg-surface shadow-1">
      <header className="flex items-center gap-4 border-b border-line px-6 py-5">
        <span aria-hidden="true" className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-band text-band-gold">
          <Icon className="size-5" strokeWidth={1.75} />
          <span className="t-figure absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full border-2 border-surface bg-accent text-[0.6875rem] font-bold text-band">
            {toArabicDigits(number)}
          </span>
        </span>
        <span className="min-w-0">
          <h2 id={`invite-section-${number}`} className="text-lg font-bold text-brand-ink">
            {title}
          </h2>
          <span className="t-caption block">{description}</span>
        </span>
      </header>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}

function OfficerCard({ order, caption, accent, children }: { order: string; caption: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-xl border p-5", accent ? "border-primary/30 bg-primary-soft/30" : "border-line bg-surface-muted/60")}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={cn("flex size-10 items-center justify-center rounded-full", accent ? "bg-primary text-primary-ink" : "bg-accent-soft text-accent-ink")}>
          {accent ? <KeyRound className="size-4" strokeWidth={1.75} /> : <UserRound className="size-4" strokeWidth={1.75} />}
        </span>
        <span>
          <span className="block font-bold text-ink">المسؤول {order}</span>
          <span className="t-caption block">{caption}</span>
        </span>
      </div>
      {children}
    </div>
  );
}

/** A labelled input with a leading icon. */
function TextField({
  name,
  label,
  icon: Icon,
  required,
  ltr: isLtr,
  type = "text",
  inputMode,
  placeholder,
  hint,
  error,
  className,
}: {
  name: string;
  label: string;
  icon: LucideIcon;
  required?: boolean;
  ltr?: boolean;
  type?: string;
  inputMode?: "numeric" | "email" | "url";
  placeholder?: string;
  hint?: string;
  error?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={name} className="text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span className="ms-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ms-1 font-normal text-ink-subtle">(اختياري)</span>
        )}
      </label>
      <div className="relative">
        <Icon aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
        <Input
          id={name}
          name={name}
          type={type}
          dir={isLtr ? "ltr" : undefined}
          inputMode={inputMode}
          placeholder={placeholder}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          autoComplete="off"
          // The icon sits at the start of the (right-to-left) page; in a left-to-right input that is its end.
          className={cn("h-12", isLtr ? "pe-10" : "ps-10")}
        />
      </div>
      {error ? (
        <p id={`${name}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Link2, title: "إنشاء الرابط", text: "تحفظ البيانات الأساسية فيُنشأ رابط تسجيل خاص بالجمعية." },
  { icon: Send, title: "الجمعية تستكمل", text: "ترسل الرابط إلى الجمعية فتستكمل بياناتها وترفق الخطاب." },
  { icon: ClipboardCheck, title: "المراجعة والاعتماد", text: "تراجع الطلب في «طلبات التسجيل»، واعتماده ينشئ حساب الجمعية بكلمة مرور مؤقتة." },
];

const COMPLETES: { icon: LucideIcon; text: string }[] = [
  { icon: MapPin, text: "مكان تقديم الخدمة: المسجد الحرام أو المسجد النبوي وأماكنه" },
  { icon: Phone, text: "هاتف الجمعية وجوال المسؤولَين" },
  { icon: FileText, text: `الخطاب بصيغة ${ltr("PDF")}` },
  { icon: Building2, text: "التصنيف وسنة التأسيس والشعار" },
];

/** What happens after the form, beside it. */
function Guide({ hours }: { hours: number }) {
  return (
    <aside className="flex flex-col gap-5 xl:sticky xl:top-[168px]">
      <section className="band-scope relative overflow-hidden rounded-xl bg-band p-6 text-band-ink shadow-1">
        <p className="text-xs font-medium text-band-gold">كيف يعمل</p>
        <h2 className="mt-1 text-lg font-bold">من الإضافة إلى الاعتماد</h2>
        <ol className="mt-5 flex flex-col">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative flex gap-4 pb-5 last:pb-0">
              {i < STEPS.length - 1 ? <span aria-hidden="true" className="absolute start-[19px] top-10 bottom-0 w-px bg-white/15" /> : null}
              <span aria-hidden="true" className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-band-gold/40 bg-white/[0.06] text-band-gold">
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block font-bold">
                  {toArabicDigits(i + 1)}. {title}
                </span>
                <span className="mt-0.5 block text-sm leading-relaxed text-band-ink-muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-line bg-surface p-6 shadow-1">
        <h2 className="font-bold text-brand-ink">تستكمل الجمعية من الرابط</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {COMPLETES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-ink-muted">
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
              {text}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent-soft/50 p-5">
        <Timer aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent-ink" strokeWidth={1.75} />
        <div className="text-sm leading-relaxed text-ink">
          <p className="font-bold">يبقى الرابط صالحًا {formatNumber(hours)} ساعة</p>
          <p className="mt-1 text-ink-muted">ويُستعمل مرة واحدة. يمكن تعديل مدته لكل رابط من صفحة الطلب.</p>
          <Link href="/admin/settings" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
            <Settings2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
            تعديل المدة الافتراضية
          </Link>
        </div>
      </section>
    </aside>
  );
}
