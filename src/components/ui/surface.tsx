import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Bordered surface card on the page canvas. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-xl border border-line bg-surface shadow-1", className)} {...props} />;
}

/** Section heading: a small gold diamond before the text. */
export function SectionTitle({ children, as: Tag = "h2", className }: { children: ReactNode; as?: "h2" | "h3"; className?: string }) {
  return (
    <Tag className={cn("t-section flex items-center gap-2.5", className)}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rotate-45 bg-accent" />
      {children}
    </Tag>
  );
}

/** Icon tile of a card header: soft green square, or a gold diamond when the card has no icon. */
export function HeaderIcon({ icon, tone = "green" }: { icon?: ReactNode; tone?: "green" | "gold" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-[9px] border [&_svg]:size-[18px]",
        tone === "gold" ? "border-accent/25 bg-accent-soft text-accent-ink" : "border-primary-soft bg-primary-soft/60 text-primary",
      )}
    >
      {icon ?? <span className="size-2 rotate-45 bg-accent" />}
    </span>
  );
}

/**
 * Card header (design handoff `.ch`): icon tile, title and subtitle, tools at the end, and a
 * hairline under it. `flush` drops the padding and the hairline for headings inside a padded box.
 */
export function PanelHeader({
  title,
  description,
  actions,
  icon,
  tone,
  flush,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  tone?: "green" | "gold";
  flush?: boolean;
  className?: string;
}) {
  if (flush) {
    return (
      <header className={cn("mb-3 flex items-start justify-between gap-4", className)}>
        <div className="min-w-0">
          <SectionTitle>{title}</SectionTitle>
          {description ? <p className="t-caption mt-1 ps-4">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2 text-sm">{actions}</div> : null}
      </header>
    );
  }
  return (
    <header className={cn("panel-head mb-5 flex items-center gap-3 border-b border-line px-5 py-4 sm:px-6", className)}>
      <HeaderIcon icon={icon} tone={tone} />
      <div className="min-w-0 flex-1">
        <h2 className="t-section leading-snug">{title}</h2>
        {description ? <p className="mt-0.5 text-[0.8125rem] text-ink-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-sm">{actions}</div> : null}
    </header>
  );
}

export type StatusTone = "neutral" | "info" | "review" | "warn" | "ok" | "bad";

const STATUS_PILL: Record<StatusTone, string> = {
  neutral: "bg-st-neutral-soft text-st-neutral",
  info: "bg-st-info-soft text-st-info",
  review: "bg-st-review-soft text-st-review",
  warn: "bg-st-warn-soft text-st-warn",
  ok: "bg-st-ok-soft text-st-ok",
  bad: "bg-st-bad-soft text-st-bad",
};

/** Status pill: soft tint of the status colour, a dot and the status name. */
export function StatusText({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-[6px] px-2.5 py-0.5 text-[0.8125rem] font-semibold leading-6",
        STATUS_PILL[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT_RULE: Record<AlertTone, string> = {
  info: "border-st-info/30 border-s-st-info bg-st-info-soft text-st-info",
  success: "border-st-ok/30 border-s-st-ok bg-st-ok-soft text-st-ok",
  warning: "border-st-warn/30 border-s-st-warn bg-st-warn-soft text-st-warn",
  danger: "border-st-bad/30 border-s-st-bad bg-st-bad-soft text-st-bad",
};

const ALERT_ICON: Record<AlertTone, ReactNode> = {
  info: <Info strokeWidth={1.75} />,
  success: <CircleCheck strokeWidth={1.75} />,
  warning: <TriangleAlert strokeWidth={1.75} />,
  danger: <CircleAlert strokeWidth={1.75} />,
};

/** Notice on a soft status tint with a 4px side rule and icon; body text stays in ink colours. */
export function Alert({
  tone = "info",
  title,
  children,
  icon,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  /** Buttons at the end of the notice. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex flex-wrap items-start gap-3.5 rounded-lg border border-s-4 px-[18px] py-3.5 text-sm", ALERT_RULE[tone], className)}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 [&_svg]:size-[18px]">
        {icon ?? ALERT_ICON[tone]}
      </span>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-bold text-ink">{title}</p> : null}
        {children ? <div className={cn("text-ink-muted", title && "mt-0.5")}>{children}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2 self-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-sm bg-surface-sunken", className)} />;
}
