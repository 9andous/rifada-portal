import { CircleCheck, ClipboardCheck, Eye, PenLine, Send, Undo2, X, type LucideIcon } from "lucide-react";
import { DateDisplay } from "@/components/ui/date-display";
import { StatusText, type StatusTone } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import type { TimelineEntry } from "@/server/services/requests/read";

const ICONS: Record<string, LucideIcon> = {
  DRAFT: PenLine,
  SUBMITTED: Send,
  COMPLETENESS_CHECK: ClipboardCheck,
  UNDER_REVIEW: Eye,
  RETURNED: Undo2,
  APPROVED: CircleCheck,
  REJECTED: X,
};

const DOT: Record<StatusTone, string> = {
  neutral: "bg-st-neutral-soft text-st-neutral",
  info: "bg-st-info-soft text-st-info",
  review: "bg-st-review-soft text-st-review",
  warn: "bg-st-warn-soft text-st-warn",
  ok: "bg-st-ok-soft text-st-ok",
  bad: "bg-st-bad-soft text-st-bad",
};

/** Status timeline (design handoff `.tl`): tinted round icons joined by a connector, newest first. */
export function StatusTimeline({ entries }: { entries: TimelineEntry[] }) {
  const ordered = [...entries].reverse();
  return (
    <ol className="flex flex-col">
      {ordered.map((t, i) => {
        const Icon = ICONS[t.to.key] ?? CircleCheck;
        return (
          <li key={t.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < ordered.length - 1 ? <span aria-hidden="true" className="absolute start-[15px] top-9 bottom-0 w-0.5 bg-line" /> : null}
            <span aria-hidden="true" className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4", DOT[t.to.tone], i === 0 && "ring-4 ring-surface")}>
              <Icon strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <StatusText tone={t.to.tone}>{t.to.name}</StatusText>
                <DateDisplay date={t.createdAt} withTime className="t-caption" />
              </div>
              <p className="mt-1 text-sm text-ink">{t.actor ?? "النظام"}</p>
              {t.note ? <p className="mt-1.5 whitespace-pre-line rounded-md border border-line bg-surface-muted px-3 py-2 text-[0.8125rem] leading-relaxed text-ink-muted">{t.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
