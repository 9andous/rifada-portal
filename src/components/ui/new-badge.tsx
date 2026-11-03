import { cn } from "@/lib/cn";

/**
 * «جديد» before a row's first cell (owner's review, D-130): green text that pulses softly until the
 * viewer opens the record; it comes back after the next action on it. Still under reduced motion.
 */
export function NewBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full bg-st-ok-soft px-2 py-0.5 text-xs font-bold leading-none text-st-ok motion-safe:animate-pulse", className)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-st-ok" />
      جديد
    </span>
  );
}
