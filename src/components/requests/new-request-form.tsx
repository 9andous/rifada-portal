"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProgramIcon } from "@/components/brand/program-icon";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { createDraftAction } from "@/server/actions/requests";
import type { RequestFormState } from "@/server/actions/requests-state";

export type ProgramChoice = { id: string; number: number; name: string; initiatives: { id: string; number: number; name: string }[] };

/** Step one of a new request: the program (as cards), then one of its initiatives open for requests. */
export function NewRequestForm({ programs }: { programs: ProgramChoice[] }) {
  const { state, onSubmit, pending } = useActionForm<RequestFormState>(createDraftAction, {});
  const [programId, setProgramId] = useState("");
  const router = useRouter();
  const e = state.errors ?? {};
  useEffect(() => {
    if (state.ok && state.createdId) router.replace(`/association/requests/${state.createdId}/edit`);
  }, [state, router]);
  const program = programs.find((p) => p.id === programId);
  const initiatives = program?.initiatives ?? [];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}

      <fieldset aria-describedby={e.programId ? "req-program-error" : undefined}>
        <legend className="mb-3 text-sm font-semibold text-ink">
          البرنامج
          <span className="ms-1 text-danger" aria-hidden="true">
            *
          </span>
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {programs.map((p) => {
            const selected = p.id === programId;
            return (
              <label
                key={p.id}
                className={cn(
                  "relative flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-3.5 transition-[border-color,background-color,box-shadow]",
                  "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                  selected ? "border-primary bg-primary-soft/50 shadow-[inset_0_0_0_1px_var(--primary)]" : "border-line hover:border-line-strong hover:bg-surface-muted",
                )}
              >
                <input
                  type="radio"
                  name="programId"
                  value={p.id}
                  checked={selected}
                  onChange={() => setProgramId(p.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-md [&_svg]:size-[22px]",
                    selected ? "bg-primary text-primary-ink" : "bg-primary-soft text-primary",
                  )}
                >
                  <ProgramIcon number={p.number} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-accent-ink">البرنامج {toArabicDigits(p.number)}</span>
                  <span className="mt-0.5 block text-sm font-bold leading-snug text-ink">{p.name}</span>
                  <span className="mt-1 block text-xs text-ink-subtle">{formatNumber(p.initiatives.length)} مبادرة متاحة</span>
                </span>
                {selected ? (
                  <span aria-hidden="true" className="absolute end-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-ink">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
        {e.programId ? (
          <p id="req-program-error" className="mt-2 text-xs text-danger" role="alert">
            {e.programId}
          </p>
        ) : null}
      </fieldset>

      <Field
        id="req-initiative"
        label="المبادرة"
        hint={program ? `مبادرات ${program.name} المتاحة لتقديم الطلبات حاليًا.` : "اختر البرنامج أولًا لعرض مبادراته."}
        error={e.initiativeId}
        required
      >
        <Select
          id="req-initiative"
          name="initiativeId"
          key={programId}
          defaultValue=""
          disabled={!programId}
          placeholder="اختر المبادرة"
          aria-invalid={Boolean(e.initiativeId)}
          options={initiatives.map((i) => ({ value: i.id, label: `${toArabicDigits(i.number)}. ${i.name}` }))}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <p className="t-caption max-w-md">بعد المتابعة تُنشأ مسودة الطلب، ولا يتغير البرنامج ولا المبادرة بعدها؛ ويمكنكم حذف المسودة والبدء من جديد.</p>
        <SubmitButton pending={pending} pendingLabel="جارٍ إنشاء المسودة…">
          متابعة إلى بيانات الطلب
        </SubmitButton>
      </div>
    </form>
  );
}
