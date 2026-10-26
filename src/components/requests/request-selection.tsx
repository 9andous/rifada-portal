"use client";

import { Check, RotateCcw, UserRoundCog, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatNumber, requestsPhrase } from "@/lib/format";
import { DECISION_LABELS, type Decision } from "@/lib/requests";
import { DecisionDialog, ReassignDialog, type DialogRequest, type SupervisorChoice } from "./decision-dialog";

// Client islands of the requests table (change 16). The rows are rendered on the server; only the
// checkboxes, the hover actions, the selection bar and the dialogs run in the browser and share the
// selection through this context.

type DialogState = { kind: "decide"; decision: Decision; requests: DialogRequest[]; round: number } | { kind: "reassign"; requests: DialogRequest[]; round: number } | null;

type SelectionContext = {
  /** Requests the viewer may decide, in page order. */
  selectable: DialogRequest[];
  selected: string[];
  toggle: (id: string, on: boolean) => void;
  setAll: (on: boolean) => void;
  openDecision: (decision: Decision, requests: DialogRequest[]) => void;
};

const Ctx = createContext<SelectionContext | null>(null);

function useSelection(): SelectionContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Request selection used outside its provider");
  return ctx;
}

export function RequestSelection({
  selectable,
  max,
  supervisors,
  children,
}: {
  selectable: DialogRequest[];
  max: number;
  supervisors: SupervisorChoice[] | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const chosen = selectable.filter((r) => selected.includes(r.id));
  const tooMany = chosen.length > max;
  const next = (d: DialogState) => (d ? d.round + 1 : 1);

  const value: SelectionContext = {
    selectable,
    selected,
    toggle: (id, on) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id))),
    setAll: (on) => setSelected(on ? selectable.map((r) => r.id) : []),
    openDecision: (decision, requests) => setDialog((d) => ({ kind: "decide", decision, requests, round: next(d) })),
  };
  function done() {
    setSelected([]);
    router.refresh();
  }

  return (
    <Ctx.Provider value={value}>
      {chosen.length > 0 ? (
        <div role="region" aria-label="الإجراءات الجماعية" className="flex flex-wrap items-center gap-3 border-y border-primary-soft bg-primary-soft/50 px-6 py-3">
          <span className="text-sm font-semibold text-primary">{requestsPhrase(chosen.length)} محددة</span>
          {tooMany ? <span className="text-xs text-st-bad">الحد الأقصى للإجراء الجماعي {requestsPhrase(max)}.</span> : null}
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => value.openDecision("approve", chosen)} disabled={tooMany}>
              <Check aria-hidden="true" strokeWidth={1.75} />
              اعتماد المحدد
            </Button>
            <Button size="sm" variant="outline" onClick={() => value.openDecision("return", chosen)} disabled={tooMany}>
              <RotateCcw aria-hidden="true" strokeWidth={1.75} />
              إعادة للتعديل
            </Button>
            <Button size="sm" variant="danger" onClick={() => value.openDecision("reject", chosen)} disabled={tooMany}>
              <X aria-hidden="true" strokeWidth={1.75} />
              رفض
            </Button>
            {supervisors ? (
              <Button size="sm" variant="outline" disabled={tooMany} onClick={() => setDialog((d) => ({ kind: "reassign", requests: chosen, round: next(d) }))}>
                <UserRoundCog aria-hidden="true" strokeWidth={1.75} />
                إعادة إسناد
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              إلغاء التحديد
            </Button>
          </div>
        </div>
      ) : null}
      {children}
      <p className="sr-only" aria-live="polite">
        {chosen.length ? `${formatNumber(chosen.length)} محددة` : ""}
      </p>
      {dialog?.kind === "decide" ? (
        <DecisionDialog key={dialog.round} open onOpenChange={(v) => !v && setDialog(null)} decision={dialog.decision} requests={dialog.requests} onDone={done} />
      ) : null}
      {dialog?.kind === "reassign" && supervisors ? (
        <ReassignDialog key={dialog.round} open onOpenChange={(v) => !v && setDialog(null)} requests={dialog.requests} supervisors={supervisors} onDone={done} />
      ) : null}
    </Ctx.Provider>
  );
}

export function SelectAllCheckbox() {
  const { selectable, selected, setAll } = useSelection();
  const all = selectable.length > 0 && selectable.every((r) => selected.includes(r.id));
  return (
    <input
      type="checkbox"
      aria-label="تحديد كل الطلبات القابلة للقرار في هذه الصفحة"
      className="size-4 accent-[var(--primary)]"
      checked={all}
      disabled={selectable.length === 0}
      onChange={(e) => setAll(e.target.checked)}
    />
  );
}

export function RowCheckbox({ id, title, enabled }: { id: string; title: string; enabled: boolean }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      aria-label={`تحديد ${title}`}
      className="mt-1 size-4 accent-[var(--primary)] disabled:opacity-30"
      disabled={!enabled}
      title={enabled ? undefined : "لا يُحدَّد إلا ما هو قيد المراجعة ومن صلاحيتك القرار فيه"}
      checked={selected.includes(id)}
      onChange={(e) => toggle(id, e.target.checked)}
    />
  );
}

const ROW_ACTIONS: { decision: Decision; className: string }[] = [
  { decision: "approve", className: "text-st-ok hover:bg-st-ok-soft" },
  { decision: "return", className: "text-st-warn hover:bg-st-warn-soft" },
  { decision: "reject", className: "text-st-bad hover:bg-st-bad-soft" },
];

const ICONS: Record<Decision, ReactNode> = {
  approve: <Check aria-hidden="true" strokeWidth={1.75} />,
  return: <RotateCcw aria-hidden="true" strokeWidth={1.75} />,
  reject: <X aria-hidden="true" strokeWidth={1.75} />,
};

/** Approve / return / reject icons, shown on row hover or focus and always on touch screens. */
export function RowActions({ request }: { request: DialogRequest }) {
  const { openDecision } = useSelection();
  return (
    <span className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
      {ROW_ACTIONS.map((a) => (
        <button
          key={a.decision}
          type="button"
          onClick={() => openDecision(a.decision, [request])}
          aria-label={`${DECISION_LABELS[a.decision]}: ${request.title}`}
          title={DECISION_LABELS[a.decision]}
          className={cn("flex size-8 items-center justify-center rounded-sm [&_svg]:size-4", a.className)}
        >
          {ICONS[a.decision]}
        </button>
      ))}
    </span>
  );
}
