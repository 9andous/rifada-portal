"use client";

import { LoaderCircle, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { HijriDateInput } from "@/components/ui/hijri-date-input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/surface";
import { toArabicDigits } from "@/lib/format";
import { GENERAL_FIELD_LABELS, type RequirementSpec } from "@/lib/requests";
import { REQUEST_LIMITS } from "@/lib/validation/requests";
import { saveDraftAction, submitRequestAction } from "@/server/actions/requests";
import type { RequestFormState } from "@/server/actions/requests-state";
import { RequirementFiles } from "./requirement-files";

export type RequestFormDefaults = {
  title: string;
  description: string;
  targetAudience: string;
  location: string;
  startDate: string;
  endDate: string;
  custom: Record<string, string>;
};

/**
 * The officer's request form: the six general fields, then the initiative's own fields, then the
 * attachments (each file is saved as soon as it is uploaded). «حفظ المسودة» saves; «تقديم الطلب» saves
 * and runs the completeness check, which lists precisely what is missing.
 */
export function RequestForm({
  requestId,
  defaults,
  fields,
  returned,
  attachments,
}: {
  requestId: string;
  defaults: RequestFormDefaults;
  fields: RequirementSpec[];
  returned: boolean;
  attachments: Omit<ComponentProps<typeof RequirementFiles>, "error">[];
}) {
  const router = useRouter();
  const [saveState, save, saving] = useActionState<RequestFormState, FormData>(saveDraftAction.bind(null, requestId), {});
  const [submitState, submit, submitting] = useActionState<RequestFormState, FormData>(submitRequestAction.bind(null, requestId), {});
  const pending = saving || submitting;
  // The form shows the result of the button pressed last.
  const [last, setLast] = useState<"save" | "submit">("save");
  const state: RequestFormState = last === "submit" ? submitState : saveState;
  const missing = last === "submit" && !submitState.ok ? (submitState.missing ?? []) : [];

  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (submitState.ok) router.push(`/association/requests/${requestId}?submitted=1`);
    else if (submitState.missing?.length || submitState.message) notice.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [submitState, requestId, router]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    const formData = new FormData(event.currentTarget);
    setLast(intent === "submit" ? "submit" : "save");
    startTransition(() => (intent === "submit" ? submit(formData) : save(formData)));
  }

  const errors: Record<string, string | undefined> = { ...(state.errors ?? {}) };
  for (const m of missing) errors[m.field] ??= m.message;
  const err = (key: string) => errors[key];

  return (
    <form id="request-form" onSubmit={onSubmit} noValidate className="flex flex-col">
      <div ref={notice} className="scroll-mt-6" />
      {missing.length ? (
        <Alert tone="danger" title={submitState.message}>
          <ul className="mt-1 flex list-disc flex-col gap-1 ps-5">
            {missing.map((m, i) => (
              <li key={`${m.field}-${i}`}>
                <a href={`#${anchorFor(m.field)}`} className="hover:underline">
                  {m.message}
                </a>
              </li>
            ))}
          </ul>
        </Alert>
      ) : state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <FormSection n={1} title="البيانات العامة" hint="عنوان الطلب ووصفه والفئة المستهدفة ومكان التنفيذ ومدته.">
        <Field id="f-title" label={GENERAL_FIELD_LABELS.title} error={err("title")} required>
          <Input id="f-title" name="title" defaultValue={defaults.title} maxLength={REQUEST_LIMITS.title} aria-invalid={Boolean(err("title"))} />
        </Field>
        <Field id="f-description" label={GENERAL_FIELD_LABELS.description} hint="أهداف البرنامج أو المشروع وأنشطته الرئيسة." error={err("description")} required>
          <Textarea id="f-description" name="description" rows={6} defaultValue={defaults.description} maxLength={REQUEST_LIMITS.description} aria-invalid={Boolean(err("description"))} />
        </Field>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field id="f-targetAudience" label={GENERAL_FIELD_LABELS.targetAudience} error={err("targetAudience")} required>
            <Input id="f-targetAudience" name="targetAudience" defaultValue={defaults.targetAudience} maxLength={REQUEST_LIMITS.targetAudience} aria-invalid={Boolean(err("targetAudience"))} />
          </Field>
          <Field id="f-location" label={GENERAL_FIELD_LABELS.location} error={err("location")} required>
            <Input id="f-location" name="location" defaultValue={defaults.location} maxLength={REQUEST_LIMITS.location} aria-invalid={Boolean(err("location"))} />
          </Field>
          <Field id="f-startDate" label={GENERAL_FIELD_LABELS.startDate} hint={returned ? undefined : "اليوم أو بعده."} error={err("startDate")} required>
            <HijriDateInput id="f-startDate" name="startDate" defaultValue={defaults.startDate} invalid={Boolean(err("startDate"))} />
          </Field>
          <Field id="f-endDate" label={GENERAL_FIELD_LABELS.endDate} hint="لا يسبق تاريخ البداية." error={err("endDate")} required>
            <HijriDateInput id="f-endDate" name="endDate" defaultValue={defaults.endDate} invalid={Boolean(err("endDate"))} />
          </Field>
        </div>
      </FormSection>

      {fields.length > 0 ? (
        <FormSection n={2} title="بيانات المبادرة" hint="البيانات الخاصة التي تطلبها هذه المبادرة.">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {fields.map((f) => (
              <CustomField key={f.key} field={f} value={defaults.custom[f.key] ?? ""} error={err(`custom.${f.key}`)} />
            ))}
          </div>
        </FormSection>
      ) : null}

      <FormSection n={fields.length > 0 ? 3 : 2} title="المرفقات" hint="تُحفظ الملفات فور رفعها.">
        {attachments.length === 0 ? (
          <p className="t-body text-sm">لا تتطلب هذه المبادرة مرفقات.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {attachments.map((a) => (
              <RequirementFiles key={a.requirementKey} {...a} error={err(`attachment.${a.requirementKey}`)} />
            ))}
          </div>
        )}
      </FormSection>

      <div className="-mx-6 -mb-6 mt-8 flex flex-wrap items-center gap-3 rounded-b-xl border-t border-line bg-surface-muted px-6 py-4 lg:-mx-8 lg:-mb-8 lg:px-8">
        <Button type="submit" name="intent" value="submit" size="lg" disabled={pending}>
          {submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" strokeWidth={1.75} />}
          {submitting ? "جارٍ التحقق والتقديم…" : returned ? "إعادة تقديم الطلب" : "تقديم الطلب"}
        </Button>
        <Button type="submit" name="intent" value="save" size="lg" variant="outline" disabled={pending}>
          {saving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" strokeWidth={1.75} />}
          {saving ? "جارٍ الحفظ…" : "حفظ المسودة"}
        </Button>
        <p className="t-caption">يتحقق النظام عند التقديم من اكتمال البيانات والمرفقات المطلوبة.</p>
      </div>
    </form>
  );
}

/** One numbered part of the request form, separated from the next by a hairline. */
function FormSection({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-b border-line py-8 first-of-type:pt-0 last-of-type:border-0 last-of-type:pb-0">
      <header className="flex items-center gap-3">
        <span className="t-figure flex size-8 shrink-0 items-center justify-center rounded-full bg-band text-sm text-band-gold">{toArabicDigits(n)}</span>
        <div>
          <h2 className="t-section">{title}</h2>
          {hint ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function anchorFor(field: string): string {
  if (field.startsWith("custom.")) return `f-custom-${field.slice("custom.".length)}`;
  if (field.startsWith("attachment.")) return `attachment-${field.slice("attachment.".length)}`;
  if (["association", "program", "initiative"].includes(field)) return "request-form";
  return `f-${field}`;
}

function CustomField({ field, value, error }: { field: RequirementSpec; value: string; error?: string }) {
  const id = `f-custom-${field.key}`;
  const name = `custom.${field.key}`;
  const common = { id, name, "aria-invalid": Boolean(error) };
  let control: ReactNode;
  switch (field.fieldType) {
    case "TEXTAREA":
      control = <Textarea {...common} rows={4} defaultValue={value} maxLength={REQUEST_LIMITS.customLong} />;
      break;
    case "NUMBER":
      control = <Input {...common} inputMode="decimal" defaultValue={value} className="w-48" maxLength={30} />;
      break;
    case "DATE":
      control = <HijriDateInput id={id} name={name} defaultValue={value} invalid={Boolean(error)} />;
      break;
    case "SELECT":
      control = <Select {...common} defaultValue={value} placeholder="اختر" options={field.options.map((o) => ({ value: o, label: o }))} />;
      break;
    default:
      control = <Input {...common} defaultValue={value} maxLength={REQUEST_LIMITS.customText} />;
  }
  return (
    <Field id={id} label={field.label} error={error} required={field.isRequired} className={field.fieldType === "TEXTAREA" ? "md:col-span-2" : undefined}>
      {control}
    </Field>
  );
}
