"use client";

import { Check, LoaderCircle, Search, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/surface";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { changeScopeAction } from "@/server/actions/requests";

export type ScopeProgram = { id: string; number: number; name: string; initiatives: { id: string; number: number; name: string }[] };

/**
 * «تعديل البرنامج والمبادرات» (D-116): the supervisor or the unit manager moves a request under
 * review to the right programme and initiatives when the association chose wrongly. The project's
 * content cannot be changed here. The change is recorded in «سجل الطلب».
 */
export function ScopeEditor({ requestId, programs, programId, initiativeIds }: { requestId: string; programs: ScopeProgram[]; programId: string; initiativeIds: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [program, setProgram] = useState(programId);
  const [chosen, setChosen] = useState<string[]>(initiativeIds);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const current = programs.find((p) => p.id === program);
  const list = current?.initiatives ?? [];
  const q = query.trim();
  const shown = q ? list.filter((i) => i.name.includes(q) || toArabicDigits(i.number) === q || String(i.number) === q) : list;
  const toggle = (id: string) => setChosen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function submit() {
    setErrors({});
    setMessage(null);
    if (chosen.length === 0) {
      setErrors({ initiativeIds: "اختر مبادرة واحدة على الأقل." });
      return;
    }
    setPending(true);
    const r = await changeScopeAction(requestId, program, chosen, note);
    setPending(false);
    if (!r.ok) {
      setErrors(r.errors ?? {});
      setMessage(r.message ?? "تعذّر حفظ التعديل.");
      return;
    }
    setOpen(false);
    toast("حُفظ البرنامج والمبادرات", { description: "سُجّل ذلك في سجل الطلب." });
    router.refresh();
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (pending) return;
        setOpen(v);
        if (v) {
          setProgram(programId);
          setChosen(initiativeIds);
          setQuery("");
          setNote("");
          setErrors({});
          setMessage(null);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          {programId ? "تعديل" : "تحديد البرنامج والمبادرات"}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)]" />
        <Dialog.Content className="fixed inset-x-0 top-1/2 z-50 mx-auto flex max-h-[92vh] w-[min(95vw,42rem)] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-3 focus:outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <Dialog.Title className="t-section">البرنامج والمبادرات</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-muted">
                صنّفوا الطلب تحت برنامج من برامج مساره ومبادرة أو أكثر. التصنيف اختياري، ولا يتغير به محتوى الطلب ولا ملفاته.
              </Dialog.Description>
            </div>
            <Dialog.Close className="text-ink-subtle hover:text-ink" aria-label="إغلاق" disabled={pending}>
              <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            {message ? <Alert tone="danger">{message}</Alert> : null}
            <Field id="scope-program" label="البرنامج" hint="برامج مسار الطلب." error={errors.programId}>
              <Select
                id="scope-program"
                value={program}
                onChange={(e) => {
                  setProgram(e.target.value);
                  setChosen([]);
                  setQuery("");
                }}
                options={programs.map((p) => ({ value: p.id, label: `${toArabicDigits(p.number)}. ${p.name}` }))}
              />
            </Field>

            <fieldset aria-describedby={errors.initiativeIds ? "scope-initiatives-error" : undefined}>
              <legend className="flex w-full items-center justify-between text-sm font-semibold text-ink">
                <span>المبادرات</span>
                <span className="t-caption font-normal">المختارة: {formatNumber(chosen.length)}</span>
              </legend>
              {list.length > 6 ? (
                <span className="relative mt-2 block">
                  <Search aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="البحث في المبادرات"
                    aria-label="البحث في المبادرات"
                    className="h-10 w-full rounded-md border border-line-strong bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
                  />
                </span>
              ) : null}
              <ul className="mt-2 flex max-h-72 flex-col gap-1.5 overflow-y-auto pe-1">
                {shown.map((i) => {
                  const selected = chosen.includes(i.id);
                  return (
                    <li key={i.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                          "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus",
                          selected ? "border-primary bg-primary-soft/50" : "border-line hover:border-primary",
                        )}
                      >
                        <input type="checkbox" checked={selected} onChange={() => toggle(i.id)} className="sr-only" />
                        <span
                          aria-hidden="true"
                          className={cn("flex size-[18px] shrink-0 items-center justify-center rounded border-2", selected ? "border-primary bg-primary text-primary-ink" : "border-line-strong bg-surface")}
                        >
                          {selected ? <Check strokeWidth={3} className="size-3" /> : null}
                        </span>
                        <span className="text-ink">
                          <span className="t-figure me-1 text-ink-muted">{toArabicDigits(i.number)}.</span>
                          {i.name}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {errors.initiativeIds ? (
                <p id="scope-initiatives-error" role="alert" className="mt-2 text-sm font-semibold text-danger">
                  {errors.initiativeIds}
                </p>
              ) : null}
            </fieldset>

            <Field id="scope-note" label="سبب التعديل" hint="اختياري؛ يظهر في سجل الطلب." error={errors.note}>
              <Textarea id="scope-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
            <Dialog.Close asChild>
              <Button variant="outline" disabled={pending}>
                إلغاء
              </Button>
            </Dialog.Close>
            <Button variant="primary" onClick={() => void submit()} disabled={pending}>
              {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              {pending ? "جارٍ الحفظ…" : "حفظ التعديل"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
