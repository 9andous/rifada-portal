import { formatGregorian, formatHijri } from "@/lib/format";

/** Today's date on the green band: Hijri first, Gregorian smaller. */
export function BandDate({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} className="flex flex-col items-end leading-snug">
      <span className="text-[0.9375rem] font-semibold text-on-band">{formatHijri(date)}</span>
      <span className="text-xs text-on-band-muted">{formatGregorian(date)}</span>
    </time>
  );
}
