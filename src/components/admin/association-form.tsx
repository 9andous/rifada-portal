"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { OneTimeSecret } from "@/components/ui/one-time-secret";
import { Alert, SectionTitle } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
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
          <Alert tone="success" title="سُجّلت الجمعية">
            لم يُنشأ حساب مسؤول لها بعد؛ يمكنك إنشاؤه لاحقًا من صفحة المستخدمين.
          </Alert>
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

  const text = (name: Exclude<keyof AssociationFormDefaults, "imageUrl">, label: string, opts: { required?: boolean; hint?: string; ltr?: boolean; type?: string } = {}) => (
    <Field id={name} label={label} hint={opts.hint} error={e[name]} required={opts.required}>
      <Input
        id={name}
        name={name}
        type={opts.type ?? "text"}
        dir={opts.ltr ? "ltr" : undefined}
        defaultValue={defaults[name]}
        required={opts.required}
        aria-invalid={Boolean(e[name])}
        autoComplete="off"
      />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <section className="flex flex-col gap-5">
        <SectionTitle as="h3" className="text-[0.9375rem]">
          بيانات الجمعية
        </SectionTitle>
        <ImageField label="شعار الجمعية" shape="square" currentUrl={defaults.imageUrl} nameFieldId="name" defaultName={defaults.name} error={e.image} />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">{text("name", "اسم الجمعية", { required: true })}</div>
          {text("licenseNumber", "رقم الترخيص", { hint: "اختياري، ولا يتكرر بين الجمعيات." })}
          {text("classification", "التصنيف", { hint: "اختياري." })}
          {text("city", "المدينة", { hint: "اختياري." })}
          {text("region", "المنطقة", { hint: "اختياري." })}
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <SectionTitle as="h3" className="text-[0.9375rem]">
          بيانات التواصل
        </SectionTitle>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {text("contactName", "اسم مسؤول التواصل", { required: true })}
          {text("contactEmail", "البريد الإلكتروني", { hint: "اختياري.", ltr: true, type: "email" })}
          {text("contactPhone", "رقم الهاتف", { hint: "اختياري.", ltr: true, type: "tel" })}
        </div>
      </section>

      {mode === "create" ? (
        <section className="flex flex-col gap-5">
          <SectionTitle as="h3" className="text-[0.9375rem]">
            حساب مسؤول الجمعية
          </SectionTitle>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="createOfficer"
              checked={withOfficer}
              onChange={(ev) => setWithOfficer(ev.target.checked)}
              className="mt-1 size-4 accent-[var(--primary)]"
            />
            <span>
              <span className="font-medium text-ink">إنشاء حساب مسؤول الجمعية الآن</span>
              <span className="t-caption block">لكل جمعية حساب واحد. تظهر كلمة المرور المؤقتة مرة واحدة بعد الحفظ.</span>
            </span>
          </label>
          {withOfficer ? <OfficerFields errors={e} /> : null}
        </section>
      ) : null}

      <div>
        <SubmitButton pending={pending} pendingLabel="جارٍ الحفظ…">
          {mode === "create" ? "تسجيل الجمعية" : "حفظ التغييرات"}
        </SubmitButton>
      </div>
    </form>
  );
}
