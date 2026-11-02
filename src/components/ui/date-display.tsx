import { formatGregorian, formatHijri, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Hijri date as primary, Gregorian smaller beside it. Times are always Riyadh time.
 * `variant="hijri"` (table cells, owner's request) drops the Gregorian date and always shows the time.
 */
export function DateDisplay({
  date,
  withTime,
  variant = "full",
  className,
}: {
  date: Date | null | undefined;
  withTime?: boolean;
  variant?: "full" | "hijri";
  className?: string;
}) {
  if (!date) return <span className={cn("text-ink-subtle", className)}>—</span>;
  const hijriOnly = variant === "hijri";
  return (
    <time dateTime={date.toISOString()} className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <span className="whitespace-nowrap">{formatHijri(date)}</span>
      {hijriOnly ? null : <span className="whitespace-nowrap text-xs text-ink-subtle">{formatGregorian(date)}</span>}
      {withTime || hijriOnly ? <span className="whitespace-nowrap text-xs text-ink-subtle">{formatTime(date)}</span> : null}
    </time>
  );
}
