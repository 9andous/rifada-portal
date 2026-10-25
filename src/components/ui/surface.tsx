import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Bordered surface card (sharp corners) on the ivory page. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-sm border border-line bg-surface shadow-1", className)} {...props} />;
}

/** Section heading: a small gold diamond before the text. No divider line underneath. */
export function SectionTitle({ children, as: Tag = "h2", className }: { children: ReactNode; as?: "h2" | "h3"; className?: string }) {
  return (
    <Tag className={cn("t-section flex items-center gap-2.5", className)}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rotate-45 bg-accent" />
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4 px-6 pb-3 pt-5", className)}>
      <div className="min-w-0">
        <SectionTitle>{title}</SectionTitle>
        {description ? <p className="t-caption mt-1 ps-4">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2 text-sm">{actions}</div> : null}
    </header>
  );
}

export type StatusTone = "neutral" | "info" | "review" | "warn" | "ok" | "bad";

const STATUS_TEXT: Record<StatusTone, string> = {
  neutral: "text-st-neutral",
  info: "text-st-info",
  review: "text-st-review",
  warn: "text-st-warn",
  ok: "text-st-ok",
  bad: "text-st-bad",
};

/** Status as a small coloured dot plus plain text. Never a filled tag. */
export function StatusText({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold", STATUS_TEXT[tone], className)}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT_RULE: Record<AlertTone, string> = {
  info: "border-s-st-info text-st-info",
  success: "border-s-st-ok text-st-ok",
  warning: "border-s-st-warn text-st-warn",
  danger: "border-s-st-bad text-st-bad",
};

/**
 * Notice on a plain surface with a coloured side rule and icon; the text stays in ink colours.
 * No tinted banners (they turn muddy in dark mode).
 */
export function Alert({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-sm border border-s-2 border-line bg-surface px-4 py-3 text-sm", ALERT_RULE[tone], className)}
    >
      {icon ? <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span> : null}
      <div className="min-w-0">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div className={cn("text-ink-muted", title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-sm bg-surface-sunken", className)} />;
}
