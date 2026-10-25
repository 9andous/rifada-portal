"use client";

import { Copy, LoaderCircle, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { copyRequirementsAction, previewCopyAction, type CopyPreviewState } from "@/server/actions/admin/requirements";
import type { AdminFormState } from "@/server/actions/admin/state";

export type PickerProgram = { id: string; number: number; name: string; initiatives: { id: string; number: number; name: string }[] };

type Mode = "initiatives" | "program";

/**
 * «نسخ المتطلبات إلى مبادرات أخرى» (D-049, replace all): pick initiatives or a whole program, see per
 * target what will be removed, overwritten and added, then confirm. The server re-computes the
 * targets on confirmation, so the preview can never authorise more than it showed.
 */
export function CopyRequirementsDialog({ sourceId, programs, sourceCount }: { sourceId: string; programs: PickerProgram[]; sourceCount: number }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("initiatives");
  const [selected, setSelected] = useState<string[]>([]);
  const [programId, setProgramId] = useState("");
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<CopyPreviewState | null>(null);
  const [result, setResult] = useState<AdminFormState | null>(null);
  const [pending, start] = useTransition();

  const target = mode === "program" ? { programId } : { initiativeIds: selected };
  const visible = useMemo(() => {
    const needle = q.trim();
    return programs
      .map((p) => ({ ...p, initiatives: p.initiatives.filter((i) => i.id !== sourceId && (!needle || i.name.includes(needle) || String(i.number) === needle)) }))
      .filter((p) => p.initiatives.length > 0);
  }, [programs, q, sourceId]);

  function reset() {
    setMode("initiatives");
    setSelected([]);
    setProgramId("");
    setQ("");
    setPreview(null);
    setResult(null);
  }

  const canPreview = mode === "program" ? programId !== "" : selected.length > 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (pending) return;
        setOpen(v);
        if (v) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="outline">
          <Copy aria-hidden="true" strokeWidth={1.75} />
          نسخ المتطلبات إلى مبادرات أخرى
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)]" />
        <Dialog.Content className="fixed inset-x-0 top-1/2 z-50 mx-auto max-h-[90vh] w-[min(94vw,48rem)] -translate-y-1/2 overflow-y-auto rounded-sm border border-line bg-surface p-6 shadow-3 focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="t-section">نسخ المتطلبات إلى مبادرات أخرى</Dialog.Title>
            <Dialog.Close className="text-ink-subtle hover:text-ink" aria-label="إغلاق" disabled={pending}>
              <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="t-body mt-2 text-sm">
            لهذه المبادرة {formatNumber(sourceCount)} من المتطلبات. ستصبح متطلبات كل مبادرة مختارة مطابقة لها تمامًا، وتُحذف متطلباتها الحالية التي لا توجد هنا.
          </Dialog.Description>

          {result?.ok ? (
            <div className="mt-5 flex flex-col gap-4">
              <Alert tone="success">{result.message}</Alert>
              <div className="flex justify-end">
                <Dialog.Close asChild>
                  <Button variant="primary">تم</Button>
                </Dialog.Close>
              </div>
            </div>
          ) : preview?.ok && preview.items ? (
            <div className="mt-5 flex flex-col gap-4">
              {preview.items.length === 0 ? (
                <Alert tone="warning">لا توجد مبادرات مستهدفة (المبادرات المؤرشفة والمبادرة الحالية مستثناة).</Alert>
              ) : (
                <div className="overflow-x-auto">
                  <table className="t-table w-full min-w-[40rem] border-collapse text-sm">
                    <caption className="sr-only">معاينة النسخ</caption>
                    <thead className="bg-surface-muted">
                      <tr>
                        <th scope="col" className="t-label py-2 ps-3 text-start">
                          المبادرة
                        </th>
                        <th scope="col" className="t-label py-2 text-start">
                          سيُحذف
                        </th>
                        <th scope="col" className="t-label py-2 text-start">
                          سيُستبدل
                        </th>
                        <th scope="col" className="t-label py-2 pe-3 text-start">
                          سيُضاف
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.map((i) => (
                        <tr key={i.initiativeId} className="border-b border-line align-top last:border-0">
                          <td className="py-2 ps-3 pe-3">
                            <span className="t-caption block">
                              {toArabicDigits(i.programNumber)}.{toArabicDigits(i.number)}
                            </span>
                            {i.name}
                          </td>
                          <KeyCell keys={i.removed} tone="bad" />
                          <KeyCell keys={i.overwritten} tone="warn" />
                          <KeyCell keys={i.added} tone="ok" />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result && !result.ok ? <Alert tone="danger">{result.message}</Alert> : null}
              <div className="flex justify-between gap-3">
                <Button variant="ghost" disabled={pending} onClick={() => setPreview(null)}>
                  رجوع إلى الاختيار
                </Button>
                <Button
                  variant="danger"
                  disabled={pending || preview.items.length === 0}
                  onClick={() => start(async () => setResult(await copyRequirementsAction(sourceId, target)))}
                >
                  {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                  تأكيد النسخ إلى {formatNumber(preview.items.length)}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-4">
              <fieldset className="flex flex-wrap gap-5 text-sm">
                <legend className="sr-only">طريقة الاختيار</legend>
                <label className="flex items-center gap-2">
                  <input type="radio" name="copy-mode" checked={mode === "initiatives"} onChange={() => setMode("initiatives")} className="accent-[var(--primary)]" />
                  مبادرات محددة
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="copy-mode" checked={mode === "program"} onChange={() => setMode("program")} className="accent-[var(--primary)]" />
                  جميع مبادرات برنامج
                </label>
              </fieldset>
              {mode === "program" ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="copy-program" className="t-label">
                    البرنامج
                  </label>
                  <Select
                    id="copy-program"
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                    placeholder="اختر البرنامج"
                    options={programs.map((p) => ({ value: p.id, label: `${toArabicDigits(p.number)}. ${p.name}` }))}
                  />
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="copy-search" className="t-label">
                      بحث في المبادرات
                    </label>
                    <Input id="copy-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم المبادرة أو رقمها" />
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-sm border border-line">
                    {visible.map((p) => (
                      <fieldset key={p.id} className="border-b border-line last:border-0">
                        <legend className="sr-only">{p.name}</legend>
                        <p className="t-label bg-surface-muted px-3 py-2">
                          {toArabicDigits(p.number)}. {p.name}
                        </p>
                        {p.initiatives.map((i) => (
                          <label key={i.id} className="flex items-start gap-3 px-3 py-1.5 text-sm hover:bg-surface-muted">
                            <input
                              type="checkbox"
                              checked={selected.includes(i.id)}
                              onChange={(e) => setSelected((s) => (e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id)))}
                              className="mt-1 size-4 accent-[var(--primary)]"
                            />
                            <span className="t-figure w-6 shrink-0 text-ink-subtle">{toArabicDigits(i.number)}</span>
                            <span>{i.name}</span>
                          </label>
                        ))}
                      </fieldset>
                    ))}
                  </div>
                  <p className="t-caption">المختارة: {formatNumber(selected.length)}</p>
                </>
              )}
              {preview && !preview.ok ? <Alert tone="danger">{preview.message}</Alert> : null}
              <div className="flex justify-end gap-3">
                <Dialog.Close asChild>
                  <Button variant="ghost">إلغاء</Button>
                </Dialog.Close>
                <Button variant="primary" disabled={!canPreview || pending} onClick={() => start(async () => setPreview(await previewCopyAction(sourceId, target)))}>
                  {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                  معاينة
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function KeyCell({ keys, tone }: { keys: string[]; tone: "bad" | "warn" | "ok" }) {
  return (
    <td className="py-2 pe-3">
      {keys.length === 0 ? (
        <span className="text-ink-subtle">—</span>
      ) : (
        <>
          <span className={cn("t-figure font-semibold", tone === "bad" ? "text-st-bad" : tone === "warn" ? "text-st-warn" : "text-st-ok")}>{formatNumber(keys.length)}</span>
          <span className="t-caption block">
            <bdi dir="ltr" className="font-mono">
              {keys.join(", ")}
            </bdi>
          </span>
        </>
      )}
    </td>
  );
}
