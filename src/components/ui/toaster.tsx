"use client";

import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

// Short confirmations (saved, sent, created) and live notices (a new notification), D-111.
// A tiny module store: `toast()` can be called from any client code; <Toaster /> in the root
// layout renders the stack. At most four show; each leaves after a few seconds.

type Tone = "success" | "info" | "danger";
export type Toast = { id: number; title: string; description?: string; tone: Tone };

const MAX = 4;
const LIFETIME_MS = 5000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function toast(title: string, options: { description?: string; tone?: Tone } = {}) {
  const item: Toast = { id: nextId++, title, description: options.description, tone: options.tone ?? "success" };
  toasts = [...toasts, item].slice(-MAX);
  emit();
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: Toast[] = [];

/** Toasts a successful action's message once per new result (`state` from useActionState). */
export function useResultToast(state: { ok?: boolean; message?: string } | null | undefined) {
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state?.ok && state.message) toast(state.message);
  }, [state]);
}

const TONE: Record<Tone, string> = {
  success: "border-st-ok/40 [&_.toast-icon]:text-st-ok",
  info: "border-st-info/40 [&_.toast-icon]:text-st-info",
  danger: "border-st-bad/40 [&_.toast-icon]:text-st-bad",
};
const ICON: Record<Tone, typeof Info> = { success: CircleCheck, info: Info, danger: TriangleAlert };

function ToastItem({ t }: { t: Toast }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [t.id]);
  const Icon = ICON[t.tone];
  return (
    <li className={cn("pointer-events-auto flex w-[min(92vw,24rem)] items-start gap-3 rounded-xl border bg-surface p-4 text-ink shadow-3", TONE[t.tone])}>
      <Icon aria-hidden="true" strokeWidth={1.75} className="toast-icon mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-bold leading-snug">{t.title}</p>
        {t.description ? <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{t.description}</p> : null}
      </div>
      <button type="button" onClick={() => dismiss(t.id)} aria-label="إغلاق" className="shrink-0 rounded-md p-1 text-ink-subtle hover:bg-surface-sunken hover:text-ink">
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}

export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  return (
    <ol aria-live="polite" aria-label="التنبيهات" data-print="hide" className="pointer-events-none fixed bottom-5 end-5 z-[60] flex flex-col gap-2">
      {items.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </ol>
  );
}
