import { CalendarDays } from "lucide-react";
import { formatGregorian, formatHijri } from "@/lib/format";

/** Today's date as a chip in the page head: Hijri first, Gregorian smaller. */
export function BandDate({ date }: { date: Date }) {
  return (
    <time
      dateTime={date.toISOString()}
      className="inline-flex items-center gap-2.5 rounded-md border border-line bg-surface-muted px-3.5 py-2 leading-tight"
    >
      <CalendarDays aria-hidden="true" strokeWidth={1.75} className="size-[18px] text-accent-ink" />
      <span>
        <span className="block text-sm font-semibold text-ink">{formatHijri(date)}</span>
        <span className="block text-xs text-ink-subtle">{formatGregorian(date)}</span>
      </span>
    </time>
  );
}
