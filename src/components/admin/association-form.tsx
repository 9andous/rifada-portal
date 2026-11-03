"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { OneTimeSecret } from "@/components/ui/one-time-secret";
import { FormError } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { cn } from "@/lib/cn";
import { toArabicDigits } from "@/lib/format";
import type { AdminFormState } from "@/server/actions/admin/state";
import { ImageField } from "./image-field";
import { OfficerFields } from "./officer-fields";

export type AssociationFormDefaults = {
  name: string;
  licenseNumber: string;
  city: string;
  region: string;
  classification: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  /** The current logo's URL, if any. */
  imageUrl?: string | null;
};

const EMPTY: AssociationFormDefaults = {
  name: "",
  licenseNumber: "",
  city: "",
  region: "",
  classification: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
};

export function AssociationForm({
  mode,
  action,
  defaults = EMPTY,
}: {
  mode: "create" | "edit";
  action: (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  defaults?: AssociationFormDefaults;
}) {
  const { state, onSubmit, pending } = useActionForm<AdminFormState>(action, {});
  const [withOfficer, setWithOfficer] = useState(false);
  const e = state.errors ?? {};

  if (mode === "create" && state.ok) {
    return (
      <div className="flex flex-col gap-5">
        {state.credentials ? (
          <OneTimeSecret title="سُجّلت الجمعية وأُنشئ حساب مسؤولها" username={state.credentials.username} password={state.credentials.password} />
        ) : (
          <p className="text-sm text-ink-muted">لم يُنشأ حساب مسؤول لها بعد؛ يمكنك إنشاؤه لاحقًا من صفحة المستخدمين.</p>
        )}
        <div className="flex flex-wrap gap-3">
          {state.createdId ? (
            <Link href={`/admin/associations/${state.createdId}`} className={buttonClasses("primary")}>
              فتح صفحة الجمعية
            </Link>
          ) : null}
          {/* A full reload clears the one-time password from memory before the next entry. */}
          <Button variant="outline" onClick={() => window.location.reload()}>
            تسجيل جمعية أخرى
          </Button>
          <Link href="/admin/associations" className={buttonClasses("ghost")}>
            العودة إلى سجل الجمعيات
          </Link>
        </div>
      </div>
    );
  }

  const text = (name: Exclude<keyof AssociationFormDefaults, "imageUrl">, label: string, opts: { required?: boolean; hint?: string; ltr?: boolean; type?: string; placeholder?: string } = {}) => (
    <Field id={name} label={opts.required ? label : <>{label} <span className="font-normal text-ink-subtle">(اختياري)</span></>} hint={opts.hint} error={e[name]} required={opts.required}>
      <Input
        id={name}
        name={name}
        type={opts.type ?? "text"}
        dir={opts.ltr ? "ltr" : undefined}
        defaultValue={defaults[name]}
        placeholder={opts.placeholder}
        required={opts.required}
        aria-invalid={Boolean(e[name])}
        autoComplete="off"
      />
    </Field>
  );

  // One card per subject, numbered like the request form (owner's review, D-130).
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {state.message && !state.ok ? <FormError>{state.message}</FormError> : null}

      <FormCard number={1} title="بيانات الجمعية" description="الاسم كما في الترخيص، وشعار الجمعية إن وُجد.">
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[auto_1fr]">
          <ImageField label="شعار الجمعية" shape="square" currentUrl={defaults.imageUrl} nameFieldId="name" defaultName={defaults.name} error={e.image} />
          {text("name", "اسم الجمعية", { required: true, placeholder: "مثال: جمعية هدية الحاج والمعتمر الخيرية" })}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          {text("licenseNumber", "رقم الترخيص", { hint: "لا يتكرر بين الجمعيات.", ltr: true })}
          {text("classification", "التصنيف")}
          {text("city", "المدينة")}
          {text("region", "المنطقة")}
        </div>
      </FormCard>

      <FormCard number={2} title="بيانات التواصل" description="من تتواصل معه الوحدة الإشرافية في شؤون الجمعية.">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">{text("contactName", "اسم مسؤول التواصل", { required: true })}</div>
          {text("contactEmail", "البريد الإلكتروني", { ltr: true, type: "email", placeholder: "name@example.org" })}
          {text("contactPhone", "رقم الهاتف", { ltr: true, type: "tel", placeholder: "05xxxxxxxx" })}
        </div>
      </FormCard>

      {mode === "create" ? (
        <FormCard number={3} title="حساب مسؤول الجمعية" description="لكل جمعية حساب واحد. تظهر كلمة المرور المؤقتة مرة واحدة بعد الحفظ.">
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3.5 transition-colors",
              withOfficer ? "border-primary bg-primary-soft/50" : "border-line-strong hover:bg-surface-muted",
            )}
          >
            <input
              type="checkbox"
              name="createOfficer"
              checked={withOfficer}
              onChange={(ev) => setWithOfficer(ev.target.checked)}
              className="mt-1 size-4 accent-[var(--primary)]"
            />
            <span>
              <span className="font-semibold text-ink">إنشاء حساب مسؤول الجمعية الآن</span>
              <span className="t-caption block">يمكن إنشاؤه لاحقًا من صفحة المستخدمين.</span>
            </span>
          </label>
          {withOfficer ? (
            <div className="mt-5">
              <OfficerFields errors={e} />
            </div>
          ) : null}
        </FormCard>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-muted px-5 py-4">
        <p className="text-sm text-ink-muted">
          الحقول المعلَّمة بـ<span className="text-danger">*</span> مطلوبة.
        </p>
        <SubmitButton pending={pending} pendingLabel="جارٍ الحفظ…">
          {mode === "create" ? "تسجيل الجمعية" : "حفظ التغييرات"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** A numbered section of the form: number, title and a line of help, then its fields. */
function FormCard({ number, title, description, children }: { number: number; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`assoc-section-${number}`} className="rounded-xl border border-line bg-surface">
      <header className="flex items-start gap-3.5 border-b border-line px-5 py-4">
        <span aria-hidden="true" className="t-figure flex size-9 shrink-0 items-center justify-center rounded-full bg-band text-band-gold">
          {toArabicDigits(number)}
        </span>
        <span>
          <h3 id={`assoc-section-${number}`} className="font-bold text-brand-ink">
            {title}
          </h3>
          <span className="t-caption block">{description}</span>
        </span>
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}
