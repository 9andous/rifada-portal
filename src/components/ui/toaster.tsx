"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// Short confirmations (saved, sent, created) and live notices (a new notification), D-111.
// A tiny module store: `toast()` can be called from any client code; <Toaster /> in the root
// layout renders them. Since D-124 each one is a card in the centre of the screen over a dimmed
// page, one at a time (the others wait their turn), closed with «حسنًا», Esc, a click outside or
// by itself after a few seconds.

type Tone = "success" | "info" | "danger";
export type Toast = { id: number; title: string; description?: ReactNode; tone: Tone };

const MAX = 4;
const LIFETIME_MS = 6000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function toast(title: string, options: { description?: ReactNode; tone?: Tone } = {}) {
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

const BADGE: Record<Tone, string> = {
  success: "bg-st-ok-soft text-st-ok",
  info: "bg-accent-soft text-accent-ink",
  danger: "bg-st-bad-soft text-st-bad",
};
const BORDER: Record<Tone, string> = { success: "border-st-ok/40", info: "border-accent/40", danger: "border-st-bad/40" };

/** Status badge: the ring draws itself, then the tick (success), the exclamation (danger) or the «i» (info). */
function StatusMark({ tone }: { tone: Tone }) {
  return (
    <span aria-hidden="true" className={cn("mark-pop flex size-[72px] shrink-0 items-center justify-center rounded-full", BADGE[tone])}>
      <svg viewBox="0 0 52 52" className="size-[52px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle className="mark-ring" cx="26" cy="26" r="23" strokeWidth="2.5" />
        {tone === "success" ? (
          <path className="mark-stroke" d="M15.5 27 L22.5 34 L37 19.5" strokeWidth="3.5" />
        ) : tone === "danger" ? (
          <>
            <path className="mark-stroke" d="M26 15 V29" strokeWidth="3.5" />
            <circle className="mark-dot" cx="26" cy="36.5" r="2" fill="currentColor" stroke="none" />
          </>
        ) : (
          <>
            <circle className="mark-dot" cx="26" cy="16.5" r="2" fill="currentColor" stroke="none" />
            <path className="mark-stroke" d="M26 23 V37" strokeWidth="3.5" />
          </>
        )}
      </svg>
    </span>
  );
}

function PopUp({ t }: { t: Toast }) {
  const okRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const close = () => dismiss(t.id);

  useEffect(() => {
    // Focus moves to «حسنًا» so Enter and Esc work at once, and returns where it was on close.
    const previous = document.activeElement as HTMLElement | null;
    okRef.current?.focus({ preventScroll: true });
    const timer = setTimeout(() => dismiss(t.id), LIFETIME_MS);
    return () => {
      clearTimeout(timer);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [t.id]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    // Keep Tab inside the card (two buttons).
    if (event.key === "Tab") {
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      buttons[(i + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }
  }

  return (
    <div className="pop-overlay pointer-events-auto fixed inset-0 flex items-center justify-center bg-[var(--overlay)] p-4" onClick={close}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={t.description ? bodyId : undefined}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className={cn(
          "pop-in relative flex w-[min(92vw,26rem)] flex-col items-center gap-3 rounded-2xl border bg-surface px-7 pb-6 pt-8 text-center text-ink shadow-3",
          BORDER[t.tone],
        )}
      >
        <StatusMark tone={t.tone} />
        <p id={titleId} className="mt-1 text-[1.0625rem] font-bold leading-snug">
          {t.title}
        </p>
        {t.description ? (
          <div id={bodyId} className="-mt-1.5 text-sm text-ink-muted">
            {t.description}
          </div>
        ) : null}
        <button ref={okRef} type="button" onClick={close} className={buttonClasses("outline", "sm", "mt-1")}>
          حسنًا
        </button>
        <button type="button" onClick={close} aria-label="إغلاق" className="absolute end-3 top-3 rounded-md p-1 text-ink-subtle hover:bg-surface-sunken hover:text-ink">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  const current = items[0];
  return (
    <div aria-live="polite" aria-label="التنبيهات" data-print="hide" className="pointer-events-none fixed inset-0 z-[60]" hidden={!current}>
      {current ? <PopUp key={current.id} t={current} /> : null}
    </div>
  );
}
