import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Vertical timeline (docs/DESIGN.md: Timeline): diamond markers joined by a hairline connector.
 * One component for the request history («مسار الطلب»), the request form's step guide
 * («خطوات الطلب») and the association's submission guide («دليل التقديم»).
 */
export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn("flex flex-col", className)}>{children}</ol>;
}

/** current: the one gold marker; done: green; muted: grey (upcoming steps, older entries, guides). */
export type TimelineMarker = "current" | "done" | "muted";

const MARKER: Record<TimelineMarker, string> = {
  current: "bg-accent",
  done: "bg-primary",
  muted: "bg-ink-subtle/60",
};

export function TimelineItem({ marker = "muted", step, children }: { marker?: TimelineMarker; step?: boolean; children: ReactNode }) {
  return (
    <li aria-current={step && marker === "current" ? "step" : undefined} className="group/tl relative flex gap-4 pb-6 last:pb-0">
      <span aria-hidden="true" className="absolute start-[7px] top-5 bottom-0 w-px bg-line-strong group-last/tl:hidden" />
      <span aria-hidden="true" className="relative mt-1.5 flex size-4 shrink-0 items-center justify-center">
        <span className={cn("size-2.5 rotate-45", MARKER[marker])} />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

/** Main line of a timeline entry. */
export function TimelineTitle({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return <p className={cn("text-sm text-ink", strong ? "font-bold" : "font-semibold")}>{children}</p>;
}

/** Smaller muted line under the title. */
export function TimelineText({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("t-caption mt-0.5 leading-relaxed", className)}>{children}</p>;
}
