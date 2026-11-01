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
      <span aria-hidden="true" className="size-2 shrink-0 rotate-45 bg-accent" />
      {children}
    </Tag>
  );
}

/** Gold diamond of a card header, centred on the first line of a `t-section` title. */
export function HeaderDiamond() {
  return <span aria-hidden="true" className="mt-[9px] size-2 shrink-0 rotate-45 bg-accent" />;
}

/**
 * Card header (docs/DESIGN.md: Card header): gold diamond, title and subtitle, tools at the end,
 * and a hairline under it. `flush` drops the padding and the hairline for headings inside a
 * padded box. `icon` replaces the diamond with the handoff's 36px icon tile (dashboard cards, D-097).
 */
export function PanelHeader({
  title,
  description,
  actions,
  flush,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  icon?: ReactNode;
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
    <header className={cn("panel-head mb-5 flex gap-3 border-b border-line px-5 py-4 sm:px-6", icon ? "flex-wrap items-center" : "items-start", className)}>
      {icon ? (
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-primary-soft bg-surface-muted text-primary [&_svg]:size-[18px]">
          {icon}
        </span>
      ) : (
        <HeaderDiamond />
      )}
      <div className={cn("min-w-0 flex-1", icon && "basis-48")}>
        <h2 className="t-section leading-snug">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-subtle">{description}</p> : null}
      </div>
      {actions ? <div className={cn("flex shrink-0 flex-wrap items-center justify-end gap-2 text-sm", icon && "max-sm:w-full max-sm:justify-start")}>{actions}</div> : null}
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
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-[6px] px-2.5 py-0.5 text-sm font-semibold leading-6",
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

// Diamond and title colour per tone; information keeps the gold of the card headers.
const ALERT_MARK: Record<AlertTone, string> = { info: "bg-accent", success: "bg-st-ok", warning: "bg-st-warn", danger: "bg-st-bad" };
const ALERT_TITLE: Record<AlertTone, string> = { info: "text-ink", success: "text-st-ok", warning: "text-st-warn", danger: "text-st-bad" };

/**
 * Notice in the brand-strip style (docs/DESIGN.md: Notices, D-124): no box, no icon. A diamond
 * before the title, as in card headers, and the text indented under it; the diamond and title take
 * the status colour except for information. `ruled` sets it in a plain white card (border, shadow
 * 1), for a notice standing on the page canvas or in the page head rather than inside a card.
 */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  ruled,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Buttons at the end of the notice. */
  action?: ReactNode;
  ruled?: boolean;
  className?: string;
}) {
  const lead = title ?? children;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex flex-wrap items-center gap-x-6 gap-y-3 text-sm leading-relaxed", ruled && "rounded-xl border border-line bg-surface px-5 py-4 shadow-1", className)}
    >
      {/* The text keeps at least 15rem: on a narrow screen the buttons move under it rather than squeezing it. */}
      <div className="min-w-0 flex-1 basis-60">
        <div className={cn("flex items-start gap-2.5", title ? cn("text-[0.9375rem] font-bold", ALERT_TITLE[tone]) : "text-ink-muted")}>
          <span aria-hidden="true" className={cn("mt-[0.6em] size-2 shrink-0 rotate-45", ALERT_MARK[tone])} />
          <div className="min-w-0 flex-1">{lead}</div>
        </div>
        {title && children ? <div className="mt-1 ps-[18px] text-ink-muted">{children}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** A form's refusal as plain red text by the fields or the submit button (no notice strip). */
export function FormError({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("text-sm font-semibold text-st-bad", className)}>
      {children}
    </p>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-sm bg-surface-sunken", className)} />;
}
