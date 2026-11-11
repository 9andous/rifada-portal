"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { toArabicDigits } from "@/lib/format";
import type { RequestGoal, TargetGroup } from "@/lib/requests";
import { FIELD_INPUT, FormField } from "./fields";

// The parts of the request form that the association picks rather than types (D-151): the
// programme of its track and one or more of its initiatives, and the target groups, each with the
// number of people it targets. Goals are written by the association, each with its measure.

export type WizardChoice = { id: string; name: string; description: string | null };
export type WizardTrack = WizardChoice & { programIds: string[] };
export type WizardRequestType = WizardChoice & { requiresDetail: boolean };
export type WizardProgram = {
  id: string;
  number: number;
  name: string;
  description: string | null;
  goals: { id: string; number: number; text: string }[];
  initiatives: { id: string; number: number; name: string }[];
};

/** A native select with the chosen option's description under it. */
export function SelectField({
  id,
  name,
  label,
  hint,
  options,
  value,
  onChange,
  error,
  disabled,
  placeholder = "يُرجى الاختيار من القائمة",
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  options: WizardChoice[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const chosen = options.find((o) => o.id === value);
  return (
    <FormField id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className={cn(FIELD_INPUT, "h-11 disabled:cursor-not-allowed disabled:bg-surface-muted")}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {/* A disabled select is not sent with the form: keep the value so a save does not clear it. */}
      {disabled ? <input type="hidden" name={name} value={value} /> : null}
      {chosen?.description ? <p className="text-sm leading-relaxed text-ink-muted">{chosen.description}</p> : null}
    </FormField>
  );
}

/** A list of checkboxes; `values` keeps the order of `options`. */
export function CheckList({
  id,
  name,
  label,
  hint,
  options,
  values,
  onChange,
  error,
  empty,
}: {
  id: string;
  /** The form name of each ticked box; omitted when a hidden input carries the value instead. */
  name?: string;
  label: string;
  hint: string;
  options: { value: string; label: string; number?: number }[];
  values: string[];
  onChange: (values: string[]) => void;
  error?: string;
  empty: string;
}) {
  function toggle(value: string, on: boolean) {
    const next = new Set(values);
    if (on) next.add(value);
    else next.delete(value);
    onChange(options.map((o) => o.value).filter((v) => next.has(v)));
  }
  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={`${id}-hint`} aria-invalid={Boolean(error)}>
      <legend className="text-[0.9375rem] font-semibold text-ink">{label}</legend>
      <p id={`${id}-hint`} className="text-sm leading-relaxed text-ink-muted">
        {hint}
      </p>
      {options.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-strong bg-surface-muted px-4 py-3 text-sm text-ink-muted">{empty}</p>
      ) : (
        <div className={cn("max-h-80 overflow-y-auto rounded-md border bg-surface", error ? "border-danger" : "border-line-strong")}>
          {options.map((o, i) => {
            const checked = values.includes(o.value);
            return (
              <label
                key={o.value}
                className={cn("flex cursor-pointer items-start gap-3 border-t border-line px-4 py-2.5 first:border-0 hover:bg-surface-muted", checked && "bg-primary-soft/40")}
              >
                <input
                  id={i === 0 ? id : undefined}
                  type="checkbox"
                  name={name}
                  value={o.value}
                  checked={checked}
                  onChange={(e) => toggle(o.value, e.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                />
                <span className="text-base leading-relaxed text-ink">
                  {o.number !== undefined ? <span className="t-figure me-1.5 font-semibold text-accent-ink">{toArabicDigits(o.number)}.</span> : null}
                  {o.label}
                </span>
              </label>
            );
          })}
        </div>
      )}
      {values.length ? <p className="text-sm text-ink-muted">اخترتم {toArabicDigits(values.length)} من {toArabicDigits(options.length)}.</p> : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** «الفئات المستهدفة»: one row per group with the number it targets; «إضافة فئة» adds a row. */
export function TargetGroupsField({
  id,
  label,
  groups,
  onChange,
  error,
}: {
  id: string;
  label: string;
  groups: TargetGroup[];
  onChange: (groups: TargetGroup[]) => void;
  error?: string;
}) {
  const rows = groups.length ? groups : [{ name: "", count: "" }];
  const set = (index: number, patch: Partial<TargetGroup>) => onChange(rows.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={`${id}-hint`}>
      <legend className="text-[0.9375rem] font-semibold text-ink">{label}</legend>
      <p id={`${id}-hint`} className="text-sm leading-relaxed text-ink-muted">
        اكتبوا كل فئة يخدمها المشروع، وأمامها مؤشر القياس: عدد المستهدفين منها. مثال: طلاب حلقات القرآن الكريم — ٣٠٠.
      </p>
      <div className="flex flex-col gap-3">
        {rows.map((g, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_7.5rem_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={i === 0 ? id : `${id}-${i}`} className="text-sm font-semibold text-ink-muted">
                الفئة {toArabicDigits(i + 1)}
              </label>
              <input
                id={i === 0 ? id : `${id}-${i}`}
                value={g.name}
                maxLength={200}
                onChange={(e) => set(i, { name: e.target.value })}
                placeholder="مثال: الحجاج والمعتمرون"
                aria-invalid={Boolean(error) && (!g.name.trim() || !g.count)}
                className={cn(FIELD_INPUT, "h-11")}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-${i}-count`} className="text-sm font-semibold text-ink-muted">
                العدد المستهدف
              </label>
              <input
                id={`${id}-${i}-count`}
                value={g.count ? toArabicDigits(g.count) : ""}
                inputMode="numeric"
                maxLength={12}
                onChange={(e) => set(i, { count: e.target.value.replace(/[^0-9٠-٩]/g, "") })}
                placeholder="٠"
                aria-invalid={Boolean(error) && Boolean(g.name.trim()) && !g.count}
                className={cn(FIELD_INPUT, "t-figure h-11")}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-11"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              disabled={rows.length === 1 && !g.name && !g.count}
              aria-label={`حذف الفئة ${toArabicDigits(i + 1)}`}
            >
              <Trash2 aria-hidden="true" strokeWidth={1.75} />
            </Button>
          </div>
        ))}
      </div>
      <div>
        <Button variant="outline" size="sm" onClick={() => onChange([...rows, { name: "", count: "" }])} disabled={rows.length >= 30}>
          <Plus aria-hidden="true" strokeWidth={1.75} />
          إضافة فئة
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** «الأهداف والمخرجات المتوقعة»: goals the association writes, each with its measure («مؤشر القياس»). */
export function GoalsField({
  id,
  label,
  goals,
  onChange,
  error,
}: {
  id: string;
  label: string;
  goals: RequestGoal[];
  onChange: (goals: RequestGoal[]) => void;
  error?: string;
}) {
  const rows = goals.length ? goals : [{ goal: "", measure: "" }];
  const set = (index: number, patch: Partial<RequestGoal>) => onChange(rows.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={`${id}-hint`}>
      <legend className="text-[0.9375rem] font-semibold text-ink">{label}</legend>
      <p id={`${id}-hint`} className="text-sm leading-relaxed text-ink-muted">
        اكتبوا كل هدف يحققه المشروع، وأمامه مؤشر القياس الذي يبيّن تحققه. مثال: تحفيظ ضيوف الرحمن أجزاء من القرآن الكريم — عدد الأجزاء المحفوظة.
      </p>
      <div className="flex flex-col gap-3">
        {rows.map((g, i) => (
          <div key={i} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={i === 0 ? id : `${id}-${i}`} className="text-sm font-semibold text-ink-muted">
                الهدف {toArabicDigits(i + 1)}
              </label>
              <input
                id={i === 0 ? id : `${id}-${i}`}
                value={g.goal}
                maxLength={300}
                onChange={(e) => set(i, { goal: e.target.value })}
                placeholder="مثال: رفع جودة خدمة ضيوف الرحمن"
                aria-invalid={Boolean(error) && (!g.goal.trim() || !g.measure.trim())}
                className={cn(FIELD_INPUT, "h-11")}
              />
            </div>
            <div className="flex items-end gap-2 sm:contents">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor={`${id}-${i}-measure`} className="text-sm font-semibold text-ink-muted">
                  مؤشر القياس
                </label>
                <input
                  id={`${id}-${i}-measure`}
                  value={g.measure}
                  maxLength={300}
                  onChange={(e) => set(i, { measure: e.target.value })}
                  placeholder="مثال: نسبة رضا المستفيدين"
                  aria-invalid={Boolean(error) && Boolean(g.goal.trim()) && !g.measure.trim()}
                  className={cn(FIELD_INPUT, "h-11")}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-11"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                disabled={rows.length === 1 && !g.goal && !g.measure}
                aria-label={`حذف الهدف ${toArabicDigits(i + 1)}`}
              >
                <Trash2 aria-hidden="true" strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div>
        <Button variant="outline" size="sm" onClick={() => onChange([...rows, { goal: "", measure: "" }])} disabled={rows.length >= 30}>
          <Plus aria-hidden="true" strokeWidth={1.75} />
          إضافة هدف
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
