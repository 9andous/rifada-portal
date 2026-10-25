"use client";

import { PenLine } from "lucide-react";
import { Field, Textarea } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { updateObjectiveAction } from "@/server/actions/admin/taxonomy";

export type ObjectiveRow = { id: string; number: number; title: string; description: string | null; sourceNote: string | null; linkCount: number };

/** The 7 strategic objectives: title and description only (no create, no archive; D-053). */
export function ObjectivesList({ objectives, readOnly }: { objectives: ObjectiveRow[]; readOnly: boolean }) {
  return (
    <ol className="flex flex-col">
      {objectives.map((o) => (
        <li key={o.id} className="grid grid-cols-[2.5rem_1fr_auto] items-start gap-4 border-t border-line px-6 py-4 first:border-0">
          <span className="t-figure text-2xl font-bold text-accent-ink">{toArabicDigits(o.number)}</span>
          <div className="min-w-0">
            <p className="font-semibold leading-relaxed text-ink">{o.title}</p>
            {o.description ? <p className="t-body mt-1 text-sm">{o.description}</p> : null}
            <p className="t-caption mt-1">المبادرات المرتبطة: {formatNumber(o.linkCount)}</p>
            {o.sourceNote ? <p className="t-caption mt-1 whitespace-pre-line">{o.sourceNote}</p> : null}
          </div>
          {readOnly ? null : (
            <FormDialog
              trigger={
                <>
                  <PenLine aria-hidden="true" strokeWidth={1.75} />
                  تعديل
                </>
              }
              triggerSize="sm"
              title={`تعديل الهدف الإستراتيجي ${toArabicDigits(o.number)}`}
              description="يُحفظ العنوان السابق في ملاحظة المصدر عند أول تعديل. رقم الهدف ثابت."
              submitLabel="حفظ"
              wide
              action={updateObjectiveAction.bind(null, o.id)}
            >
              {(e) => (
                <>
                  <Field id={`obj-title-${o.number}`} label="العنوان" error={e.title} required>
                    <Textarea id={`obj-title-${o.number}`} name="title" defaultValue={o.title} className="min-h-20" aria-invalid={Boolean(e.title)} />
                  </Field>
                  <Field id={`obj-desc-${o.number}`} label="الوصف" hint="اختياري." error={e.description}>
                    <Textarea id={`obj-desc-${o.number}`} name="description" defaultValue={o.description ?? ""} aria-invalid={Boolean(e.description)} />
                  </Field>
                </>
              )}
            </FormDialog>
          )}
        </li>
      ))}
    </ol>
  );
}
