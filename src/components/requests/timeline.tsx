import { DateDisplay } from "@/components/ui/date-display";
import { StatusText } from "@/components/ui/surface";
import { Timeline, TimelineItem, TimelineText } from "@/components/ui/timeline";
import type { TimelineEntry } from "@/server/services/requests/read";

/** Status timeline («مسار الطلب»): newest first, the latest entry marked gold. */
export function StatusTimeline({ entries }: { entries: TimelineEntry[] }) {
  const ordered = [...entries].reverse();
  return (
    <Timeline>
      {ordered.map((t, i) => (
        <TimelineItem key={t.id} marker={i === 0 ? "current" : "muted"}>
          <StatusText tone={t.to.tone}>{t.to.name}</StatusText>
          <p className="mt-1 text-sm text-ink">{t.actor ?? "النظام"}</p>
          {t.note ? <TimelineText className="whitespace-pre-line">{t.note}</TimelineText> : null}
          <DateDisplay date={t.createdAt} withTime className="t-caption mt-1" />
        </TimelineItem>
      ))}
    </Timeline>
  );
}
