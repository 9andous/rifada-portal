"use client";

import { Archive, ArchiveRestore, PenLine, Plus } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/states/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Textarea } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Alert, StatusText } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { toArabicDigits } from "@/lib/format";
import { createGoalAction, moveGoalAction, setGoalArchivedAction, updateGoalAction } from "@/server/actions/admin/taxonomy";
import type { AdminFormState } from "@/server/actions/admin/state";
import { MoveButtons } from "./move-buttons";

export type GoalRow = { id: string; number: number; text: string; sourceNote: string | null; archived: boolean };

function GoalText({ errors, defaultValue }: { errors: Record<string, string | undefined>; defaultValue?: string }) {
  return (
    <Field id="goal-text" label="نص الهدف" error={errors.text} required>
      <Textarea id="goal-text" name="text" defaultValue={defaultValue} aria-invalid={Boolean(errors.text)} />
    </Field>
  );
}

/** The program's goals in order: add, edit, move up/down, archive/restore. */
export function GoalsEditor({ programId, goals }: { programId: string; goals: GoalRow[] }) {
  const [result, setResult] = useState<AdminFormState | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 px-6">
        <p className="t-caption">الترتيب هو رقم الهدف؛ يُحفظ كل نقل فور تنفيذه.</p>
        <FormDialog
          trigger={
            <>
              <Plus aria-hidden="true" strokeWidth={1.75} />
              هدف جديد
            </>
          }
          triggerVariant="primary"
          title="هدف جديد"
          description="يُضاف الهدف في آخر القائمة، ويمكن نقله بعد ذلك."
          submitLabel="إضافة الهدف"
          action={createGoalAction.bind(null, programId)}
        >
          {(errors) => <GoalText errors={errors} />}
        </FormDialog>
      </div>
      {result?.message ? <Alert tone={result.ok ? "success" : "danger"} className="mx-6">{result.message}</Alert> : null}
      {goals.length === 0 ? (
        <EmptyState variant="inline" title="لا توجد أهداف لهذا البرنامج" description="أضف أهداف البرنامج كما وردت في وثيقة الإستراتيجية." />
      ) : (
        <ol className="flex flex-col">
          {goals.map((g, index) => (
            <li key={g.id} className={cn("grid grid-cols-[2rem_1fr_auto] items-start gap-3 border-t border-line px-6 py-3", g.archived && "text-ink-subtle")}>
              <span className="t-figure pt-0.5 font-bold text-accent-ink">{toArabicDigits(g.number)}</span>
              <div className="min-w-0 text-sm leading-relaxed">
                <p className={g.archived ? "text-ink-subtle" : "text-ink"}>{g.text}</p>
                {g.archived ? <StatusText tone="neutral" className="mt-1 text-xs">مؤرشف</StatusText> : null}
                {g.sourceNote ? <p className="t-caption mt-1 whitespace-pre-line">{g.sourceNote}</p> : null}
              </div>
              <div className="flex items-center gap-1">
                <MoveButtons id={g.id} label={`الهدف ${toArabicDigits(g.number)}`} first={index === 0} last={index === goals.length - 1} move={moveGoalAction} />
                <FormDialog
                  trigger={<PenLine aria-hidden="true" strokeWidth={1.75} />}
                  triggerVariant="ghost"
                  triggerSize="sm"
                  triggerLabel={`تعديل الهدف ${toArabicDigits(g.number)}`}
                  title={`تعديل الهدف ${toArabicDigits(g.number)}`}
                  description="يُحفظ النص السابق في ملاحظة المصدر عند أول تعديل."
                  submitLabel="حفظ"
                  action={updateGoalAction.bind(null, g.id)}
                >
                  {(errors) => <GoalText errors={errors} defaultValue={g.text} />}
                </FormDialog>
                <ConfirmDialog
                  trigger={g.archived ? <ArchiveRestore aria-hidden="true" strokeWidth={1.75} /> : <Archive aria-hidden="true" strokeWidth={1.75} />}
                  triggerVariant="ghost"
                  triggerSize="sm"
                  triggerLabel={`${g.archived ? "استعادة" : "أرشفة"} الهدف ${toArabicDigits(g.number)}`}
                  title={g.archived ? "استعادة الهدف" : "أرشفة الهدف"}
                  description={g.archived ? "يعود الهدف إلى قائمة أهداف البرنامج." : "يختفي الهدف من الصفحات العامة ويبقى محفوظًا هنا، ويمكن استعادته."}
                  confirmLabel={g.archived ? "استعادة" : "أرشفة"}
                  confirmVariant={g.archived ? "primary" : "danger"}
                  onConfirm={async () => setResult(await setGoalArchivedAction(g.id, !g.archived))}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
