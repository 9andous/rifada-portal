"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/surface";
import type { Decision } from "@/lib/requests";
import { REQUEST_LIMITS } from "@/lib/validation/requests";
import { DecisionDialog, type DialogRequest } from "./decision-dialog";

const CHOICES: { decision: Decision; label: string; icon: ReactNode; variant: "primary" | "outline" | "danger" }[] = [
  { decision: "approve", label: "اعتماد", icon: <Check aria-hidden="true" strokeWidth={1.75} />, variant: "primary" },
  { decision: "return", label: "إعادة للتعديل", icon: <RotateCcw aria-hidden="true" strokeWidth={1.75} />, variant: "outline" },
  { decision: "reject", label: "رفض", icon: <X aria-hidden="true" strokeWidth={1.75} />, variant: "danger" },
];

/**
 * «القرار» (change 16): a side panel (at the top of the sticky side column) with the three choices
 * and the reason field; at tablet width a fixed bottom bar. Every choice opens the centred confirmation, where the reason can still
 * be edited. The server re-checks that the request is still under review.
 */
export function DecisionPanel({ request }: { request: DialogRequest }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [dialog, setDialog] = useState<{ decision: Decision; round: number } | null>(null);
  const open = (decision: Decision) => setDialog((d) => ({ decision, round: (d?.round ?? 0) + 1 }));

  return (
    <>
      <section aria-labelledby="decision-title" className="hidden rounded-sm border border-line bg-surface p-5 shadow-1 lg:block">
        <SectionTitle as="h2">
          <span id="decision-title">القرار</span>
        </SectionTitle>
        <p className="t-caption mt-1 ps-4">يُبلَّغ مسؤول الجمعية بالقرار وسببه.</p>
        <Field id="panel-reason" label="السبب" hint="مطلوب عند الإعادة للتعديل والرفض." className="mt-4">
          <Textarea id="panel-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={REQUEST_LIMITS.reason} />
        </Field>
        <div className="mt-4 flex flex-col gap-2">
          {CHOICES.map((c) => (
            <Button key={c.decision} variant={c.variant} onClick={() => open(c.decision)} className="w-full">
              {c.icon}
              {c.label}
            </Button>
          ))}
        </div>
      </section>

      {/* Tablet and phone: a fixed bar at the bottom of the screen; the reason is entered in the dialog. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 py-3 shadow-3 lg:hidden" role="region" aria-label="القرار">
        <div className="mx-auto flex max-w-[1280px] items-center gap-2">
          <span className="t-label me-auto">القرار</span>
          {CHOICES.map((c) => (
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
