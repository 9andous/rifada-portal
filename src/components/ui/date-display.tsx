import { formatGregorian, formatHijri, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Hijri date as primary, Gregorian smaller beside it. Times are always Riyadh time. */
export function DateDisplay({
  date,
  withTime,
  className,
}: {
  date: Date | null | undefined;
  withTime?: boolean;
  className?: string;
}) {
  if (!date) return <span className={cn("text-ink-subtle", className)}>—</span>;
  return (
    <time dateTime={date.toISOString()} className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <span className="whitespace-nowrap">{formatHijri(date)}</span>
      <span className="whitespace-nowrap text-xs text-ink-subtle">{formatGregorian(date)}</span>
      {withTime ? <span className="text-xs text-ink-subtle">{formatTime(date)}</span> : null}
    </time>
  );
}
