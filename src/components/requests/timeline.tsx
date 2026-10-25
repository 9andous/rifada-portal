import { DateDisplay } from "@/components/ui/date-display";
import { StatusText } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import type { TimelineEntry } from "@/server/services/requests/read";

/**
 * Status timeline as in direction C: diamond nodes joined by the connector line, newest first.
 * No other rules or dividers (change 16).
 */
export function StatusTimeline({ entries }: { entries: TimelineEntry[] }) {
  const ordered = [...entries].reverse();
  return (
    <ol className="flex flex-col">
      {ordered.map((t, i) => (
        <li key={t.id} className="relative flex gap-4 pb-6 last:pb-0">
          {i < ordered.length - 1 ? <span aria-hidden="true" className="absolute start-[7px] top-5 bottom-0 w-px bg-line-strong" /> : null}
          <span aria-hidden="true" className="relative mt-1.5 flex size-4 shrink-0 items-center justify-center">
            <span className={cn("size-2.5 rotate-45", i === 0 ? "bg-accent" : "bg-ink-subtle/60")} />
          </span>
          <div className="min-w-0">
            <StatusText tone={t.to.tone}>{t.to.name}</StatusText>
            <p className="mt-0.5 text-sm text-ink">{t.actor ?? "النظام"}</p>
            {t.note ? <p className="t-caption mt-0.5 whitespace-pre-line">{t.note}</p> : null}
            <DateDisplay date={t.createdAt} withTime className="t-caption mt-1" />
          </div>
        </li>
      ))}
    </ol>
  );
}
