"use client";

import { Check, PenLine, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { HeaderDiamond, StatusText } from "@/components/ui/surface";
import { RECOMMENDATION_LABELS, RECOMMENDATION_TONES, type Decision } from "@/lib/requests";
import { REQUEST_LIMITS } from "@/lib/validation/requests";
import { DecisionDialog, type DialogRequest } from "./decision-dialog";
import { EvaluationDialog } from "./evaluation-dialog";

type Variant = "primary" | "warning" | "danger";
type Choice = { decision: Decision; label: string; confirmLabel: string; icon: ReactNode; variant: Variant };

const RETURN: Choice = { decision: "return", label: "إعادة للتعديل", confirmLabel: "تأكيد الإعادة للتعديل", icon: <RotateCcw aria-hidden="true" strokeWidth={1.75} />, variant: "warning" };
const REJECT: Choice = { decision: "reject", label: "رفض", confirmLabel: "تأكيد الرفض", icon: <X aria-hidden="true" strokeWidth={1.75} />, variant: "danger" };
const APPROVE: Choice = { decision: "approve", label: "اعتماد نهائي", confirmLabel: "اعتماد نهائي", icon: <Check aria-hidden="true" strokeWidth={1.75} />, variant: "primary" };

/**
 * «القرار» (change 16, D-139, D-145): a side panel (at the top of the sticky side column); at tablet width
 * a fixed bottom bar. The supervisor evaluates, signs and recommends («تقييم واعتماد»), which sends the
 * request to the unit manager, who confirms or overrules it; or returns or rejects it directly when its
 * data is wrong. Every decision opens the centred confirmation; the server re-checks everything.
 */
export function DecisionPanel({
  request,
  canEvaluate,
  canApprove,
  canDecide,
  recommendation,
}: {
  request: DialogRequest;
  canEvaluate: boolean;
  canApprove: boolean;
  canDecide: boolean;
  /** What the supervisor recommended, when the request is with the unit manager. */
  recommendation?: { decision: Decision; reason: string | null } | null;
}) {
  const router = useRouter();
  // The supervisor's reason is offered to the manager, who may change it before it reaches the association.
  const offered = recommendation?.reason ?? "";
  const [reason, setReason] = useState(offered);
  const [dialog, setDialog] = useState<{ decision: Decision; round: number } | null>(null);
  const open = (decision: Decision) => setDialog((d) => ({ decision, round: (d?.round ?? 0) + 1 }));
  const choices = [...(canApprove ? [APPROVE] : []), ...(canDecide ? [RETURN, REJECT] : [])];
  const labelOf = (c: Choice) => (c.decision === recommendation?.decision ? c.confirmLabel : c.label);

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
              {canEvaluate ? "بعد التقييم والتوقيع يُرسل الطلب إلى مدير الوحدة، والقرار النهائي له." : canApprove ? "رفع المشرف توصيته؛ القرار النهائي لكم." : "لا يوجد مشرف نشط لتقييم الطلب؛ يتعذر اعتماده قبل تقييمه."}
            </p>
          </div>
        </div>
        <div className="p-5">
          {canEvaluate ? (
            <EvaluationDialog requestId={request.id} className="w-full">
              <PenLine aria-hidden="true" strokeWidth={1.75} />
              تقييم واعتماد
            </EvaluationDialog>
          ) : null}
          {recommendation ? <RecommendationBox recommendation={recommendation} /> : null}
          {choices.length ? (
            <>
              <Field id="panel-reason" label="السبب" hint={canEvaluate ? "مطلوب عند الإعادة للتعديل والرفض. يصل القرار إلى الجمعية مباشرة." : "يُرسل إلى الجمعية عند الإعادة للتعديل أو الرفض."} className={canEvaluate ? "mt-5 border-t border-line pt-4" : recommendation ? "mt-4" : undefined}>
                <Textarea id="panel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={REQUEST_LIMITS.reason} />
              </Field>
              <div className="mt-4 flex flex-col gap-2">
                {choices.map((c) => (
                  <Button key={c.decision} variant={c.variant} onClick={() => open(c.decision)} className="w-full">
                    {c.icon}
                    {labelOf(c)}
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
          {recommendation ? <StatusText tone={RECOMMENDATION_TONES[recommendation.decision]}>{`توصية المشرف: ${RECOMMENDATION_LABELS[recommendation.decision]}`}</StatusText> : null}
          {canEvaluate ? (
            <EvaluationDialog requestId={request.id} size="sm">
              <PenLine aria-hidden="true" strokeWidth={1.75} />
              تقييم واعتماد
            </EvaluationDialog>
          ) : null}
          {choices.map((c) => (
            <Button key={c.decision} size="sm" variant={c.variant} onClick={() => open(c.decision)}>
              {c.icon}
              {labelOf(c)}
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
          // An approval's note may reach the association: never the supervisor's reason for returning or rejecting.
          initialReason={dialog.decision === "approve" && reason === offered ? "" : reason}
          onDone={() => router.refresh()}
        />
      ) : null}
    </>
  );
}

/** What the supervisor recommended and why, above the unit manager's decision (D-139). */
function RecommendationBox({ recommendation }: { recommendation: { decision: Decision; reason: string | null } }) {
  return (
    <div className="rounded-md border border-line bg-surface-muted px-3.5 py-3">
      <p className="text-xs font-semibold text-ink-muted">توصية المشرف</p>
      <p className="mt-1.5">
        <StatusText tone={RECOMMENDATION_TONES[recommendation.decision]}>{RECOMMENDATION_LABELS[recommendation.decision]}</StatusText>
      </p>
      {recommendation.reason ? <p className="mt-2 whitespace-pre-line text-sm text-ink">{recommendation.reason}</p> : null}
    </div>
  );
}
