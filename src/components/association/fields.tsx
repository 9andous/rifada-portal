import { Check, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatNumber, toArabicDigits } from "@/lib/format";

// Form parts of the association pages (D-102), in the platform's look: the label and its
// explanation above the control, «(اختياري)» on the few optional fields (every other field is
// required), the error below; and the step list of the request journey, as on the registration page.

export const FIELD_INPUT =
  "w-full rounded-md border border-line-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-subtle transition-[border-color,box-shadow] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 aria-[invalid=true]:border-danger";

export function FormField({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: string; error?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.9375rem] font-semibold text-ink">
        {label}
        {optional ? <span className="ms-1.5 text-sm font-normal text-ink-muted">(اختياري)</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm leading-relaxed text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-sm font-semibold text-danger">
          <CircleAlert aria-hidden="true" strokeWidth={2} className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type JourneyStep = { title: string; hint: string };

/** The steps of a new request, as on the registration page: done ticked, the current one gold. */
export function StepsAside({
  steps,
  current,
  onSelect,
  disabled,
  children,
}: {
  steps: JourneyStep[];
  current: number;
  /** Earlier steps can be reopened (the request form). */
  onSelect?: (index: number) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-[168px]">
      <div className="rounded-xl border border-line bg-surface p-4 shadow-1 lg:hidden">
        <p className="text-sm font-semibold text-accent-ink">
          الخطوة {formatNumber(current + 1)} من {formatNumber(steps.length)}
        </p>
        <p className="mt-0.5 text-base font-bold text-ink">{steps[current]?.title}</p>
        <span aria-hidden="true" className="mt-3 flex gap-1.5">
          {steps.map((s, i) => (
            <span key={s.title} className={cn("h-1.5 flex-1 rounded-full", i < current ? "bg-primary" : i === current ? "bg-accent" : "bg-surface-sunken")} />
          ))}
        </span>
      </div>
      <nav aria-label="خطوات الطلب" className="hidden rounded-xl border border-line bg-surface p-3 shadow-1 lg:block">
        <ol className="flex flex-col gap-0.5">
          {steps.map((s, i) => {
            const done = i < current;
            const now = i === current;
            const reopen = done && onSelect;
            return (
              <li key={s.title}>
                <button
                  type="button"
                  disabled={!reopen || disabled}
                  onClick={() => reopen && onSelect(i)}
                  aria-current={now ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors",
                    now ? "bg-primary-soft/60" : reopen ? "hover:bg-surface-muted" : "cursor-default",
                    !done && !now && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "t-figure flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                      done ? "border-primary bg-primary text-primary-ink" : now ? "border-accent bg-accent-soft text-accent-ink" : "border-line-strong text-ink-subtle",
                    )}
                  >
                    {done ? <Check aria-hidden="true" className="size-4" strokeWidth={2.5} /> : toArabicDigits(i + 1)}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-[0.9375rem]", now ? "font-bold text-ink" : "text-ink-muted")}>{s.title}</span>
                    <span className="block text-sm text-ink-subtle">{s.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      {children}
    </aside>
  );
}

/** The card that holds one step: «الخطوة ٢ من ٥», its title and a sentence, then its content. */
export function StepCard({ number, total, title, hint, children, footer }: { number: number; total: number; title: string; hint?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface shadow-2">
      <header className="border-b border-line px-6 py-5 sm:px-8">
        <p className="ps-5 text-sm font-semibold text-accent-ink">
          الخطوة {formatNumber(number)} من {formatNumber(total)}
        </p>
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rotate-45 bg-accent" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-brand-ink">{title}</h2>
            {hint ? <p className="mt-0.5 text-[0.9375rem] text-ink-muted">{hint}</p> : null}
          </div>
        </div>
      </header>
      <div className="px-6 py-6 sm:px-8">{children}</div>
      {footer ? <footer className="rounded-b-xl border-t border-line bg-surface-muted px-6 py-4 sm:px-8">{footer}</footer> : null}
    </div>
  );
}
