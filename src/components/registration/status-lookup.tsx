"use client";

import { CircleCheck, CircleX, Hourglass, LogIn } from "lucide-react";
import Link from "next/link";
import { ArchOutline, Diamond } from "@/components/brand/arch";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { Alert, StatusText } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { lookupRegistrationAction, type LookupState } from "@/server/actions/registration";

const STATUS = {
  PENDING: { tone: "info", label: "قيد المراجعة", icon: Hourglass, text: "تراجع الوحدة الإشرافية بيانات الجمعية وترخيصها، ويُفعَّل الحساب فور اعتماد الطلب." },
  APPROVED: { tone: "ok", label: "معتمد", icon: CircleCheck, text: "اعتُمد طلبكم وفُعِّل حساب الجمعية. ادخلوا باسم المستخدم وكلمة المرور التي اخترتموها." },
  REJECTED: { tone: "bad", label: "مرفوض", icon: CircleX, text: "لم يُعتمد الطلب. اطّلعوا على السبب، ويمكنكم تقديم طلب جديد بعد استكمال المطلوب." },
} as const;

/** Public status lookup by reference and license number. */
export function RegistrationStatusLookup() {
  const { state, onSubmit, pending } = useActionForm<LookupState>(lookupRegistrationAction, {});
  const e = state.errors ?? {};
  const r = state.result;
  const s = r ? STATUS[r.status] : null;

  return (
    <>
      <section className="band-scope relative overflow-hidden bg-band text-band-ink">
        <GeometricPattern size={84} />
        <ArchOutline strokeWidth={4} className="absolute -bottom-20 end-10 hidden w-56 text-band-gold/15 md:block" />
        <div className="relative mx-auto max-w-[1360px] px-4 py-10 sm:px-8">
          <p className="flex items-center gap-2 text-sm font-medium text-band-gold">
            <Diamond className="bg-band-gold" />
            تسجيل الجمعيات
          </p>
          <h1 className="mt-2 text-[2rem] font-bold">متابعة طلب تسجيل جمعية</h1>
          <p className="mt-2 max-w-2xl text-band-ink-muted">أدخلوا رقم الطلب الذي ظهر لكم بعد الإرسال ورقم ترخيص الجمعية.</p>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-[1100px] items-start gap-6 px-4 py-10 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
        <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-line bg-surface p-6 shadow-2 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span aria-hidden="true" className="size-2 shrink-0 rotate-45 bg-accent" />
            <h2 className="text-lg font-bold text-brand-ink">بيانات الطلب</h2>
          </div>
          {state.message ? (
            <Alert tone="danger" className="mb-5">
              {state.message}
            </Alert>
          ) : null}
          <div className="flex flex-col gap-5">
            <Field id="l-ref" label="رقم الطلب" hint="مثل JM-7K2M9QXA" error={e.referenceNo} required>
              <Input id="l-ref" name="referenceNo" required dir="ltr" className="h-12 uppercase" autoComplete="off" aria-invalid={Boolean(e.referenceNo)} />
            </Field>
            <Field id="l-license" label="رقم ترخيص الجمعية" error={e.licenseNumber} required>
              <Input id="l-license" name="licenseNumber" required dir="ltr" inputMode="numeric" className="h-12" aria-invalid={Boolean(e.licenseNumber)} />
            </Field>
            <SubmitButton pending={pending} pendingLabel="جارٍ البحث…">
              عرض حالة الطلب
            </SubmitButton>
          </div>
          <p className="mt-6 text-sm text-ink-muted">
            لم تسجّلوا جمعيتكم بعد؟{" "}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              ابدؤوا التسجيل
            </Link>
          </p>
        </form>

        <section aria-live="polite" className="rounded-2xl border border-line bg-surface p-6 shadow-1 sm:p-8">
          {r && s ? (
            <div className="fade-up">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-ink-subtle">
                    طلب رقم <bdi dir="ltr">{r.referenceNo}</bdi>
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-brand-ink">{r.name}</h2>
                </div>
                <StatusText tone={s.tone}>{s.label}</StatusText>
              </div>
              <div className="mt-6 flex gap-4 rounded-xl border border-line bg-surface-muted p-5">
                <s.icon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" strokeWidth={1.75} />
                <p className="text-sm leading-[1.9] text-ink">{s.text}</p>
              </div>
              {r.note ? (
                <Alert tone="warning" title="سبب عدم الاعتماد" className="mt-4">
                  <span className="whitespace-pre-line">{r.note}</span>
                </Alert>
              ) : null}
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink-subtle">تاريخ التقديم</dt>
                  <dd className="mt-0.5 text-sm font-semibold">
                    <DateDisplay date={r.submittedAt} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-subtle">تاريخ القرار</dt>
                  <dd className="mt-0.5 text-sm font-semibold">
                    <DateDisplay date={r.decidedAt} />
                  </dd>
                </div>
              </dl>
              {r.status === "APPROVED" ? (
                <Link href="/login" className={buttonClasses("dark", "lg", "mt-6")}>
                  <LogIn aria-hidden="true" />
                  الدخول إلى المنصة{r.username ? <bdi dir="ltr" className="font-normal opacity-80">({r.username})</bdi> : null}
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                <Hourglass aria-hidden="true" className="size-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 font-bold text-ink">تظهر هنا حالة الطلب</p>
              <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-muted">قيد المراجعة، أو معتمد مع رابط الدخول، أو مرفوض مع السبب.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
