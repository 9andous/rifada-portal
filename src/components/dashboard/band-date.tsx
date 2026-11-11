import { CalendarDays } from "lucide-react";
import { formatHijri } from "@/lib/format";

/** Today's Hijri date as a chip in the page head. */
export function BandDate({ date }: { date: Date }) {
  return (
    <time
      dateTime={date.toISOString()}
      className="inline-flex items-center gap-2.5 rounded-md border border-line bg-surface-muted px-3.5 py-2 leading-tight"
    >
      <CalendarDays aria-hidden="true" strokeWidth={1.75} className="size-[18px] text-accent-ink" />
      <span className="text-sm font-semibold text-ink">{formatHijri(date)}</span>
    </time>
  );
}
