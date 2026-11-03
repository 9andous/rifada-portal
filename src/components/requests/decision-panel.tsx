"use client";

import { Check, Hourglass, PenLine, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { HeaderDiamond } from "@/components/ui/surface";
import type { Decision } from "@/lib/requests";
import { REQUEST_LIMITS } from "@/lib/validation/requests";
import { DecisionDialog, type DialogRequest } from "./decision-dialog";
import { EvaluationDialog } from "./evaluation-dialog";

type Choice = { decision: Decision; label: string; icon: ReactNode; variant: "primary" | "warning" | "danger" };

const RETURN: Choice = { decision: "return", label: "إعادة للتعديل", icon: <RotateCcw aria-hidden="true" strokeWidth={1.75} />, variant: "warning" };
const REJECT: Choice = { decision: "reject", label: "رفض", icon: <X aria-hidden="true" strokeWidth={1.75} />, variant: "danger" };
const APPROVE: Choice = { decision: "approve", label: "اعتماد نهائي", icon: <Check aria-hidden="true" strokeWidth={1.75} />, variant: "primary" };

/**
 * «القرار» (change 16, D-116): a side panel (at the top of the sticky side column); at tablet width
 * a fixed bottom bar. The supervisor evaluates and signs («تقييم واعتماد», sent to the unit manager),
 * or returns or rejects; the unit manager approves after that evaluation, or returns or rejects at
 * any time. Every decision opens the centred confirmation; the server re-checks everything.
 */
export function DecisionPanel({ request, canEvaluate, canApprove, canDecide }: { request: DialogRequest; canEvaluate: boolean; canApprove: boolean; canDecide: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [dialog, setDialog] = useState<{ decision: Decision; round: number } | null>(null);
  const open = (decision: Decision) => setDialog((d) => ({ decision, round: (d?.round ?? 0) + 1 }));
  const choices = [...(canApprove ? [APPROVE] : []), ...(canDecide ? [RETURN, REJECT] : [])];
  // The unit manager before the supervisor's evaluation: return or reject only.
  const waiting = !canEvaluate && !canApprove;
  const evaluate = (
    <>
      <PenLine aria-hidden="true" strokeWidth={1.75} />
      تقييم واعتماد
    </>
  );

  return (
    <>
      <section aria-labelledby="decision-title" className="hidden overflow-hidden rounded-xl border-2 border-primary/30 bg-surface shadow-2 lg:block">
        <div className="flex items-start gap-3 border-b border-line bg-primary-soft/50 px-5 py-3.5">
          <HeaderDiamond />
          <div>
            <h2 id="decision-title" className="t-section">
              القرار
            </h2>
            <p className="text-xs text-ink-subtle">
              {canEvaluate ? "بعد التقييم والتوقيع يُرسل الطلب إلى مدير الوحدة." : canApprove ? "قيّم المشرف الطلب ووقّعه؛ القرار النهائي لكم." : "يُبلَّغ مسؤول الجمعية بالقرار وسببه."}
            </p>
          </div>
        </div>
        <div className="p-5">
          {waiting ? (
            <p className="mb-4 flex items-start gap-2 rounded-md bg-surface-muted px-3 py-2.5 text-sm text-ink-muted">
              <Hourglass aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
              بانتظار تقييم المشرف وتوقيعه؛ يُتاح الاعتماد النهائي بعدهما.
            </p>
          ) : null}
          {canEvaluate ? <EvaluationDialog requestId={request.id} title={request.title} trigger={evaluate} /> : null}
          {choices.length ? (
            <>
              <Field id="panel-reason" label="السبب" hint="مطلوب عند الإعادة للتعديل والرفض." className={canEvaluate ? "mt-5 border-t border-line pt-4" : undefined}>
                <Textarea id="panel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={REQUEST_LIMITS.reason} />
              </Field>
              <div className="mt-4 flex flex-col gap-2">
                {choices.map((c) => (
                  <Button key={c.decision} variant={c.variant} onClick={() => open(c.decision)} className="w-full">
                    {c.icon}
                    {c.label}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
          <p className="t-caption mt-3">يُسجَّل الإجراء باسمك في سجل الطلب.</p>
        </div>
      </section>

      {/* Tablet and phone: a fixed bar at the bottom of the screen; the reason is entered in the dialog. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 py-3 shadow-3 lg:hidden" role="region" aria-label="القرار">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-2">
          <span className="t-label me-auto">القرار</span>
          {canEvaluate ? (
            <div className="w-auto [&>button]:w-auto">
              <EvaluationDialog requestId={request.id} title={request.title} trigger={evaluate} />
            </div>
          ) : null}
          {choices.map((c) => (
            <Button key={c.decision} size="sm" variant={c.variant} onClick={() => open(c.decision)}>
              {c.icon}
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {dialog ? (
        <DecisionDialog
          key={dialog.round}
          open
          onOpenChange={(v) => !v && setDialog(null)}
          decision={dialog.decision}
          requests={[request]}
          initialReason={reason}
          onDone={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
