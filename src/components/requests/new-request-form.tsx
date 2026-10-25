"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { toArabicDigits } from "@/lib/format";
import { createDraftAction } from "@/server/actions/requests";
import type { RequestFormState } from "@/server/actions/requests-state";

export type ProgramChoice = { id: string; number: number; name: string; initiatives: { id: string; number: number; name: string }[] };

/** Step one of a new request: the program, then one of its initiatives open for requests. */
export function NewRequestForm({ programs }: { programs: ProgramChoice[] }) {
  const { state, onSubmit, pending } = useActionForm<RequestFormState>(createDraftAction, {});
  const [programId, setProgramId] = useState("");
  const router = useRouter();
  const e = state.errors ?? {};
  useEffect(() => {
    if (state.ok && state.createdId) router.replace(`/association/requests/${state.createdId}/edit`);
  }, [state, router]);
  const initiatives = programs.find((p) => p.id === programId)?.initiatives ?? [];

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-2xl flex-col gap-5">
      {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field id="req-program" label="البرنامج" error={e.programId} required>
        <Select
          id="req-program"
          name="programId"
          value={programId}
          onChange={(ev) => setProgramId(ev.target.value)}
          placeholder="اختر البرنامج"
          aria-invalid={Boolean(e.programId)}
          options={programs.map((p) => ({ value: p.id, label: `${toArabicDigits(p.number)}. ${p.name}` }))}
        />
      </Field>
      <Field
        id="req-initiative"
        label="المبادرة"
        hint={programId ? "تظهر المبادرات المتاحة لتقديم الطلبات حاليًا." : "اختر البرنامج أولًا لعرض مبادراته."}
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
      <p className="t-caption">بعد المتابعة تُنشأ مسودة الطلب، ولا يتغير البرنامج ولا المبادرة بعدها؛ ويمكنكم حذف المسودة والبدء من جديد.</p>
      <div>
        <SubmitButton pending={pending} pendingLabel="جارٍ إنشاء المسودة…">
          متابعة إلى بيانات الطلب
        </SubmitButton>
      </div>
    </form>
  );
}
