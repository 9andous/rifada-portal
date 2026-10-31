"use client";

import { LoaderCircle, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { toast } from "@/components/ui/toaster";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { RefNumber } from "@/components/ui/ref-number";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/surface";
import { formatNumber, requestsPhrase } from "@/lib/format";
import { DECISION_LABELS, type Decision } from "@/lib/requests";
import { REQUEST_LIMITS } from "@/lib/validation/requests";
import { PasswordInput } from "@/components/ui/password-input";
import { approveAction, decideAction, reassignAction } from "@/server/actions/requests";
import type { BulkOutcomeView, RequestFormState } from "@/server/actions/requests-state";
import { SealNotice } from "./evaluation-dialog";

/** `approvable`: approval is offered (the unit manager, after the supervisor's evaluation, D-116). */
export type DialogRequest = { id: string; title: string; referenceNo: string | null; approvable?: boolean };

const CONFIRM_VARIANT: Record<Decision, "primary" | "outline" | "danger"> = { approve: "primary", return: "outline", reject: "danger" };
const CONFIRM_LABEL: Record<Decision, string> = { approve: "توقيع واعتماد", return: "إعادة للتعديل", reject: "رفض" };
const EFFECT: Record<Decision, string> = {
  approve: "اعتماد نهائي تُبلَّغ به الجمعية، ولا يمكن التراجع عنه. وقّع ثم أدخل كلمة المرور.",
  return: "يعود الطلب إلى الجمعية لتعديله، ويُرسل إليها السبب، وتُستأنف المهلة عند إعادة التقديم.",
  reject: "يُرفض الطلب وتُبلَّغ الجمعية بالسبب، ولا يمكن التراجع عن الرفض.",
};

function RequestList({ requests }: { requests: DialogRequest[] }) {
  if (requests.length === 1) {
    const r = requests[0];
    return (
      <p className="mt-3 text-sm">
        <span className="font-semibold text-ink">{r.title || "طلب بلا عنوان"}</span>
        {r.referenceNo ? (
          <span className="t-caption ms-2">
            <RefNumber value={r.referenceNo} />
          </span>
        ) : null}
      </p>
    );
  }
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-ink">{requestsPhrase(requests.length)} محددة:</p>
      <ul className="mt-2 max-h-40 overflow-y-auto rounded-sm border border-line bg-surface-muted px-3 py-2 text-sm">
        {requests.map((r) => (
          <li key={r.id} className="flex items-baseline justify-between gap-3 py-0.5">
            <span className="min-w-0 truncate">{r.title}</span>
            {r.referenceNo ? (
              <span className="t-caption shrink-0">
                <RefNumber value={r.referenceNo} />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Result of a single or bulk action: what was done and what was skipped, with the reason. */
export function OutcomeSummary({ outcome, verb }: { outcome: BulkOutcomeView; verb: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Alert tone={outcome.skipped.length ? "warning" : "success"} title={`${verb}: ${requestsPhrase(outcome.done.length)}`}>
        {outcome.skipped.length ? `لم يُنفَّذ الإجراء على ${requestsPhrase(outcome.skipped.length)}:` : "نُفِّذ الإجراء على جميع الطلبات المحددة."}
      </Alert>
      {outcome.skipped.length ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {outcome.skipped.map((s) => (
            <li key={s.id}>
              <span className="font-semibold text-ink">{s.title ?? "طلب غير متاح"}</span>
              {s.referenceNo ? (
                <span className="t-caption ms-2">
                  <RefNumber value={s.referenceNo} />
                </span>
              ) : null}
              <span className="t-caption block">{s.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Shell({ open, onOpenChange, title, children, busy }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: ReactNode; busy: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)]" />
        <Dialog.Content className="fixed inset-x-0 top-1/2 z-50 mx-auto max-h-[90vh] w-[min(92vw,32rem)] -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-3 focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="t-section">{title}</Dialog.Title>
            <Dialog.Close className="text-ink-subtle hover:text-ink" aria-label="إغلاق" disabled={busy}>
              <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Centred confirmation for approve / return / reject, for one request or a bulk selection
 * (change 16): the request title and reference (or the selected titles), the action, a required
 * reason for return and reject (one reason for every selected request), cancel and confirm.
 */
export function DecisionDialog({
  open,
  onOpenChange,
  decision,
  requests,
  initialReason = "",
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  decision: Decision;
  requests: DialogRequest[];
  initialReason?: string;
  onDone: (outcome: BulkOutcomeView) => void;
}) {
  const [reason, setReason] = useState(initialReason);
  const [result, setResult] = useState<RequestFormState | null>(null);
  const [busy, start] = useTransition();
  // The final approval is signed (D-117): the password confirms it, the server seals it (D-122).
  const [password, setPassword] = useState("");
  const approving = decision === "approve";
  const needsReason = !approving;
  const outcome = result?.outcome;

  function confirm() {
    start(async () => {
      const ids = requests.map((x) => x.id);
      const r = approving ? await approveAction(ids, { note: reason, password }) : await decideAction(ids, decision, reason);
      if (approving && !r.ok) setPassword("");
      setResult(r);
      if (r.ok && r.outcome) {
        onDone(r.outcome);
        if (r.outcome.skipped.length === 0) onOpenChange(false);
        toast(`تم ${DECISION_LABELS[decision]}`, { description: requests.length > 1 ? `عدد الطلبات: ${requests.length - r.outcome.skipped.length}` : requests[0]?.title });
      }
    });
  }

  return (
    <Shell open={open} onOpenChange={onOpenChange} title={requests.length > 1 ? `${DECISION_LABELS[decision]}: إجراء جماعي` : `${DECISION_LABELS[decision]} الطلب`} busy={busy}>
      {outcome ? (
        <div className="mt-4 flex flex-col gap-5">
          <OutcomeSummary outcome={outcome} verb={DECISION_LABELS[decision]} />
          <div className="flex justify-end">
            <Dialog.Close asChild>
              <Button>إغلاق</Button>
            </Dialog.Close>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <RequestList requests={requests} />
          <p className="t-body mt-3 text-sm">{EFFECT[decision]}</p>
          {needsReason ? (
            <Field id="decision-reason" label={requests.length > 1 ? "السبب (يُرسل مع كل طلب محدد)" : "السبب"} error={result?.errors?.reason} required className="mt-4">
              <Textarea
                id="decision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={REQUEST_LIMITS.reason}
                aria-invalid={Boolean(result?.errors?.reason)}
              />
            </Field>
          ) : null}
          {approving ? (
            <div className="mt-4 flex flex-col gap-3">
              <SealNotice count={requests.length} />
              <Field id="approve-password" label="كلمة المرور" error={result?.errors?.password} required>
                <PasswordInput id="approve-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" aria-invalid={Boolean(result?.errors?.password)} />
              </Field>
            </div>
          ) : null}
          {result?.message && !result.ok && !result.errors?.reason && !result.errors?.password ? (
            <Alert tone="danger" className="mt-4">
              {result.message}
            </Alert>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={busy}>
                إلغاء
              </Button>
            </Dialog.Close>
            <Button variant={CONFIRM_VARIANT[decision]} disabled={busy || (needsReason && reason.trim().length < 3) || (approving && !password)} onClick={confirm}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {requests.length > 1 ? `${CONFIRM_LABEL[decision]} (${formatNumber(requests.length)})` : CONFIRM_LABEL[decision]}
            </Button>
          </div>
        </div>
      )}
    </Shell>
  );
}

export type SupervisorChoice = { id: string; name: string; trackIds: string[]; open?: number };

/** Unit manager: reassign one or more requests to an active supervisor of their track, with a reason. */
export function ReassignDialog({
  open,
  onOpenChange,
  requests,
  supervisors,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requests: DialogRequest[];
  supervisors: SupervisorChoice[];
  onDone: (outcome: BulkOutcomeView) => void;
}) {
  const [toUserId, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<RequestFormState | null>(null);
  const [busy, start] = useTransition();
  const outcome = result?.outcome;

  function confirm() {
    start(async () => {
      const r = await reassignAction(
        requests.map((x) => x.id),
        toUserId,
        reason,
      );
      setResult(r);
      if (r.ok && r.outcome) {
        onDone(r.outcome);
        if (r.outcome.skipped.length === 0) onOpenChange(false);
        toast("تمت إعادة الإسناد");
      }
    });
  }

  return (
    <Shell open={open} onOpenChange={onOpenChange} title={requests.length > 1 ? "إعادة إسناد: إجراء جماعي" : "إعادة إسناد الطلب"} busy={busy}>
      {outcome ? (
        <div className="mt-4 flex flex-col gap-5">
          <OutcomeSummary outcome={outcome} verb="إعادة الإسناد" />
          <div className="flex justify-end">
            <Dialog.Close asChild>
              <Button>إغلاق</Button>
            </Dialog.Close>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <RequestList requests={requests} />
          <Field id="reassign-to" label="المشرف" hint="يظهر المشرفون النشطون؛ ويُتخطى كل طلب لا يشرف المختار على مساره." error={result?.errors?.toUserId} required className="mt-4">
            <Select
              id="reassign-to"
              value={toUserId}
              onChange={(e) => setTo(e.target.value)}
              placeholder="اختر المشرف"
              options={supervisors.map((s) => ({ value: s.id, label: s.open === undefined ? s.name : `${s.name} (طلبات مفتوحة: ${formatNumber(s.open)})` }))}
            />
          </Field>
          <Field id="reassign-reason" label="سبب إعادة الإسناد" error={result?.errors?.reason} required className="mt-4">
            <Textarea id="reassign-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={REQUEST_LIMITS.reason} />
          </Field>
          {result?.message && !result.ok && !result.errors ? (
            <Alert tone="danger" className="mt-4">
              {result.message}
            </Alert>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={busy}>
                إلغاء
              </Button>
            </Dialog.Close>
            <Button disabled={busy || !toUserId || reason.trim().length < 3} onClick={confirm}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              إعادة الإسناد
            </Button>
          </div>
        </div>
      )}
    </Shell>
  );
}
