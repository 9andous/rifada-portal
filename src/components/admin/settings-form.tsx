"use client";

import type { ReactNode } from "react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { Alert, SectionTitle } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { SETTING_LABELS } from "@/lib/audit-labels";
import { toArabicDigits } from "@/lib/format";
import { SETTING_LIMITS, UPLOAD_GROUP_LABELS, UPLOAD_GROUPS, type EditableSettingKey, type SettingsInput } from "@/lib/validation/settings";
import type { AdminFormState } from "@/server/actions/admin/state";

/** Pre-rendered "last changed by" captions, keyed by setting. */
export type SettingCaptions = Record<EditableSettingKey, ReactNode>;

function Group({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 border-b border-line py-6 first:pt-0 last:border-0 lg:grid-cols-[18rem_1fr] lg:gap-10">
      <div>
        <SectionTitle as="h3" className="text-[0.9375rem]">
          {title}
        </SectionTitle>
        <p className="t-caption mt-1 ps-4">{description}</p>
      </div>
      <div className="flex max-w-xl flex-col gap-5">{children}</div>
    </section>
  );
}

const range = (min: number, max: number, unit: string) => `${unit}: رقم صحيح من ${toArabicDigits(min)} إلى ${toArabicDigits(max)}.`;

export function SettingsForm({
  action,
  values,
  captions,
}: {
  action: (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  values: SettingsInput;
  captions: SettingCaptions;
}) {
  const { state, onSubmit, pending } = useActionForm<AdminFormState>(action, {});
  const e = state.errors ?? {};

  const number = (key: "sla.workingDays" | "uploads.maxFileMb" | "uploads.associationQuotaMb" | "bulk.maxItems", limits: { min: number; max: number }, unit: string) => (
    <Field id={key} label={SETTING_LABELS[key]} hint={range(limits.min, limits.max, unit)} error={e[key]} required>
      <Input
        id={key}
        name={key}
        type="number"
        inputMode="numeric"
        min={limits.min}
        max={limits.max}
        step={1}
        dir="ltr"
        defaultValue={values[key]}
        className="w-32"
        aria-invalid={Boolean(e[key])}
      />
      <span className="t-caption">{captions[key]}</span>
    </Field>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col">
      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"} className="mb-6">
          {state.message}
        </Alert>
      ) : null}

      <Group title="مهلة المراجعة" description="تُحسب من تقديم الطلب بأيام العمل (الأحد إلى الخميس)، وتُستعمل في احتساب الطلبات المتأخرة.">
        {number("sla.workingDays", SETTING_LIMITS.sla, "بأيام العمل")}
      </Group>

      <Group title="المرفقات" description="تنطبق على مرفقات الطلبات والتعليقات. لا يُسمح بملفات الفيديو في أي حال.">
        {number("uploads.maxFileMb", SETTING_LIMITS.uploadMb, "بالميغابايت")}
        <fieldset aria-describedby={e["uploads.allowedGroups"] ? "groups-error" : undefined}>
          <legend className="text-sm font-medium text-ink">{SETTING_LABELS["uploads.allowedGroups"]}</legend>
          <div className="mt-3 flex flex-col gap-2">
            {UPLOAD_GROUPS.map((g) => (
              <label key={g} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="uploads.allowedGroups"
                  value={g}
                  defaultChecked={values["uploads.allowedGroups"].includes(g)}
                  className="size-4 accent-[var(--primary)]"
                />
                {UPLOAD_GROUP_LABELS[g]}
              </label>
            ))}
          </div>
          {e["uploads.allowedGroups"] ? (
            <p id="groups-error" role="alert" className="mt-2 text-xs text-danger">
              {e["uploads.allowedGroups"]}
            </p>
          ) : null}
          <p className="t-caption mt-2">{captions["uploads.allowedGroups"]}</p>
        </fieldset>
        {number("uploads.associationQuotaMb", SETTING_LIMITS.quotaMb, "بالميغابايت، لجميع ملفات طلبات الجمعية وإصداراتها")}
      </Group>

      <Group title="الإجراءات الجماعية" description="أقصى عدد من الطلبات يمكن اعتمادها أو إعادتها أو رفضها أو إعادة إسنادها في إجراء واحد.">
        {number("bulk.maxItems", SETTING_LIMITS.bulk, "بعدد الطلبات")}
      </Group>

      <Group title="الموقع العام" description="عند الإيقاف تظهر قوائم المبادرات للمستخدمين المسجلين فقط، وتبقى صفحات البرامج العامة بأهدافها.">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="public.showInitiatives"
            defaultChecked={values["public.showInitiatives"]}
            className="mt-1 size-4 accent-[var(--primary)]"
          />
          <span>
            <span className="font-medium text-ink">{SETTING_LABELS["public.showInitiatives"]}</span>
            <span className="t-caption block">{captions["public.showInitiatives"]}</span>
          </span>
        </label>
      </Group>

      <div className="pt-6">
        <SubmitButton pending={pending} pendingLabel="جارٍ الحفظ…">
          حفظ الإعدادات
        </SubmitButton>
      </div>
    </form>
  );
}
