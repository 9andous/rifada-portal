import { formatHijri, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * The platform's dates are Hijri only (D-134). Times are always Riyadh time and shown everywhere
 * (owner's review, D-130) except with `dateOnly`, for calendar dates such as a project's start and end.
 */
export function DateDisplay({
  date,
  withTime = true,
  dateOnly = false,
  className,
}: {
  date: Date | null | undefined;
  withTime?: boolean;
  dateOnly?: boolean;
  className?: string;
}) {
  if (!date) return <span className={cn("text-ink-subtle", className)}>—</span>;
  const showTime = withTime && !dateOnly;
  return (
    <time dateTime={date.toISOString()} className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <span className="whitespace-nowrap">{formatHijri(date)}</span>
      {showTime ? <span className="whitespace-nowrap text-xs text-ink-subtle">{formatTime(date)}</span> : null}
    </time>
  );
}
