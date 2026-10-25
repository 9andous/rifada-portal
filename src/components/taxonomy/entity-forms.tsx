"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { Alert } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { toArabicDigits } from "@/lib/format";
import type { AdminFormState } from "@/server/actions/admin/state";

type Action = (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;

export type ProgramDefaults = { number: string; name: string; officialName: string; description: string; sortOrder: string };

/** Program data. After a create (or a renumber) the page moves to the program's own URL. */
export function ProgramForm({ action, defaults, mode }: { action: Action; defaults: ProgramDefaults; mode: "create" | "edit" }) {
  const { state, onSubmit, pending } = useActionForm<AdminFormState>(action, {});
  const router = useRouter();
  const e = state.errors ?? {};
  useEffect(() => {
    if (state.ok && state.createdId && (mode === "create" || state.createdId !== defaults.number)) {
      router.replace(`/admin/taxonomy/programs/${state.createdId}?tab=data`);
    }
  }, [state, mode, defaults.number, router]);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[8rem_1fr]">
        <Field id="number" label="الرقم" error={e.number} required>
          <Input id="number" name="number" inputMode="numeric" dir="ltr" defaultValue={defaults.number} aria-invalid={Boolean(e.number)} />
        </Field>
        <Field id="name" label="اسم البرنامج" error={e.name} required hint={mode === "edit" ? "يُحفظ الاسم السابق في ملاحظة المصدر عند أول تعديل." : undefined}>
          <Input id="name" name="name" defaultValue={defaults.name} aria-invalid={Boolean(e.name)} />
        </Field>
      </div>
      <Field id="officialName" label="الاسم الرسمي في الوثيقة" hint="اختياري؛ يُعرض حين يختلف عن الاسم المختصر." error={e.officialName}>
        <Input id="officialName" name="officialName" defaultValue={defaults.officialName} aria-invalid={Boolean(e.officialName)} />
      </Field>
      <Field id="description" label="الوصف" hint="اختياري." error={e.description}>
        <Textarea id="description" name="description" defaultValue={defaults.description} aria-invalid={Boolean(e.description)} />
      </Field>
      <Field id="sortOrder" label="ترتيب العرض" hint="الأصغر يظهر أولًا." error={e.sortOrder}>
        <Input id="sortOrder" name="sortOrder" inputMode="numeric" dir="ltr" defaultValue={defaults.sortOrder} className="w-32" aria-invalid={Boolean(e.sortOrder)} />
      </Field>
      <div>
        <SubmitButton pending={pending} pendingLabel="جارٍ الحفظ…">
          {mode === "create" ? "إضافة البرنامج" : "حفظ التغييرات"}
        </SubmitButton>
      </div>
    </form>
  );
}

export type InitiativeDefaults = { number: string; name: string; description: string; sourceNote: string };

/** Initiative data. A wording slip from COPY-REVIEW, if any, is shown beside the name. */
export function InitiativeForm({
  action,
  defaults,
  mode,
  slipNote,
  afterCreateBase,
}: {
  action: Action;
  defaults: InitiativeDefaults;
  mode: "create" | "edit";
  slipNote?: string;
  afterCreateBase?: string;
}) {
  const { state, onSubmit, pending } = useActionForm<AdminFormState>(action, {});
  const router = useRouter();
  const e = state.errors ?? {};
  useEffect(() => {
    if (mode === "create" && state.ok && state.createdId && afterCreateBase) router.replace(`${afterCreateBase}/${state.createdId}?tab=data`);
  }, [state, mode, afterCreateBase, router]);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      {slipNote ? (
        <Alert tone="warning" title="صياغة بانتظار مراجعتكم">
          {slipNote} عدّل الاسم أدناه إن رأيتم ذلك؛ يُحفظ النص الأصلي في ملاحظة المصدر.
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[8rem_1fr]">
        <Field id="number" label="الرقم" hint="فريد داخل البرنامج." error={e.number} required>
          <Input id="number" name="number" inputMode="numeric" dir="ltr" defaultValue={defaults.number} aria-invalid={Boolean(e.number)} />
        </Field>
        <Field id="name" label="اسم المبادرة" error={e.name} required>
          <Textarea id="name" name="name" defaultValue={defaults.name} className="min-h-16" aria-invalid={Boolean(e.name)} />
        </Field>
      </div>
      <Field id="description" label="الوصف" hint="اختياري." error={e.description}>
        <Textarea id="description" name="description" defaultValue={defaults.description} aria-invalid={Boolean(e.description)} />
      </Field>
      <Field id="sourceNote" label="ملاحظة المصدر" hint="ما يخص صياغة الاسم في الوثيقة. يُضاف النص الأصلي إليها تلقائيًا عند أول تعديل للاسم." error={e.sourceNote}>
        <Textarea id="sourceNote" name="sourceNote" defaultValue={defaults.sourceNote} className="min-h-16" aria-invalid={Boolean(e.sourceNote)} />
      </Field>
      <div>
        <SubmitButton pending={pending} pendingLabel="جارٍ الحفظ…">
          {mode === "create" ? "إضافة المبادرة" : "حفظ التغييرات"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** The 7-checkbox objective editor for one initiative. */
export function ObjectiveLinksForm({
  action,
  objectives,
  linked,
}: {
  action: Action;
  objectives: { number: number; title: string }[];
  linked: number[];
}) {
  const { state, onSubmit, pending } = useActionForm<AdminFormState>(action, {});
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <fieldset>
        <legend className="t-body text-sm">اختر الأهداف الإستراتيجية التي تخدمها هذه المبادرة.</legend>
        <div className="mt-4 flex flex-col gap-2">
          {objectives.map((o) => (
            <label
              key={o.number}
              className="flex items-start gap-3 rounded-sm border border-line px-4 py-3 text-sm hover:bg-surface-muted has-[:checked]:border-primary has-[:checked]:bg-surface-sunken"
            >
              <input type="checkbox" name="objectives" value={o.number} defaultChecked={linked.includes(o.number)} className="mt-1 size-4 accent-[var(--primary)]" />
              <span className="t-figure w-5 shrink-0 font-bold text-accent-ink">{toArabicDigits(o.number)}</span>
              <span>{o.title}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <SubmitButton pending={pending} pendingLabel="جارٍ الحفظ…">
          حفظ الارتباط
        </SubmitButton>
      </div>
    </form>
  );
}
