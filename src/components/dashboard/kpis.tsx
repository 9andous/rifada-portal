import { ChevronLeft, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArchOutline } from "@/components/brand/arch";
import { cn } from "@/lib/cn";

// Dashboard key figures and shortcut tiles as in the design handoff (`.kpi`, `.qa`), restored on
// the three role dashboards at the owner's request (D-097). Other pages keep <BandFigures>.

export type KpiTone = "primary" | "info" | "review" | "warn" | "bad" | "ok" | "gold";

const TONE_TILE: Record<KpiTone, string> = {
  primary: "bg-primary-soft text-primary",
  info: "bg-st-info-soft text-st-info",
  review: "bg-st-review-soft text-st-review",
  warn: "bg-st-warn-soft text-st-warn",
  bad: "bg-st-bad-soft text-st-bad",
  ok: "bg-st-ok-soft text-st-ok",
  gold: "bg-accent-soft text-accent-ink",
};

const TONE_TEXT: Partial<Record<KpiTone, string>> = { warn: "text-st-warn", bad: "text-st-bad" };

export type Kpi = {
  label: string;
  icon: LucideIcon;
  tone?: KpiTone;
  /** Pre-formatted value (Arabic-Indic digits); a dash when there is no data. */
  value: ReactNode;
  unit?: string;
  caption?: ReactNode;
  /** A small pill before the caption, e.g. this month's change. */
  badge?: ReactNode;
  href?: string;
  /** The green tile that leads the row. */
  featured?: boolean;
  /** Colour the figure itself (only while it needs attention). */
  alert?: boolean;
};

/**
 * The row of key figures: icon tile and label, the figure, a caption; the first may be featured.
 * `wrap` lets labels and captions run onto a second line instead of being cut short (the
 * association pages, D-102, where two tiles share a phone's width at the larger text size) and sets
 * them one step larger. Labels are bold and dark, captions semibold, on every role (D-109).
 */
export function KpiRow({ items, wrap }: { items: Kpi[]; wrap?: boolean }) {
  const cols = items.length >= 6 ? "sm:grid-cols-3 xl:grid-cols-6" : items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4";
  return (
    <dl className={cn("grid grid-cols-2 gap-3.5", cols)}>
      {items.map((k) => {
        const Icon = k.icon;
        const tone = k.tone ?? "primary";
        return (
          <div
            key={k.label}
            className={cn(
              "group relative flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-xl border px-[18px] py-4 shadow-1",
              k.featured ? "band-scope border-band bg-band text-band-ink" : "card-hover border-line bg-surface",
              k.href && "card-link",
            )}
          >
            {k.featured ? <ArchOutline strokeWidth={6} inner="transparent" className="absolute -bottom-20 -end-9 w-32 text-band-gold/15" /> : null}
            <dt className="relative flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn("flex size-[38px] shrink-0 items-center justify-center rounded-md [&_svg]:size-[19px]", k.featured ? "bg-white/10 text-band-gold" : TONE_TILE[tone])}
              >
                <Icon strokeWidth={1.75} />
              </span>
              <span
                className={cn(
                  "min-w-0",
                  wrap ? "text-base font-bold leading-snug" : "truncate text-[0.9375rem] font-bold",
                  k.href && "pe-4",
                  k.featured ? "text-band-ink" : "text-ink",
                )}
              >
                {k.label}
              </span>
              {k.href ? (
                <ChevronLeft
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className={cn("absolute end-0 top-0 size-4 transition-transform group-hover:-translate-x-0.5", k.featured ? "text-band-ink-muted" : "text-ink-subtle")}
                />
              ) : null}
            </dt>
            <dd className="relative flex items-baseline gap-1">
              <span className={cn("t-figure text-[2rem] leading-none", k.featured ? "text-band-ink" : k.alert ? (TONE_TEXT[tone] ?? "text-ink") : "text-ink")}>{k.value}</span>
              {k.unit ? <span className={cn("text-sm font-medium", k.featured ? "text-band-ink-muted" : "text-ink-subtle")}>{k.unit}</span> : null}
            </dd>
            {k.caption || k.badge ? (
              <dd
                className={cn(
                  "relative flex min-w-0 items-center gap-1.5",
                  wrap ? "text-sm font-semibold" : "text-[0.8125rem] font-semibold",
                  k.featured ? "text-band-ink-muted" : "text-ink-muted",
                )}
              >
                {k.badge ? (
                  <span className={cn("t-figure shrink-0 rounded-[6px] px-1.5 py-px text-[0.6875rem] font-semibold", k.featured ? "bg-white/10 text-band-gold" : "bg-primary-soft text-primary")}>
                    {k.badge}
                  </span>
                ) : null}
                <span className={wrap ? "leading-snug" : "truncate"}>{k.caption}</span>
              </dd>
            ) : null}
            {k.href ? (
              <Link href={k.href} className="absolute inset-0 z-10 rounded-xl">
                <span className="sr-only">عرض {k.label}</span>
              </Link>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}

export type QuickAction = { label: string; hint: ReactNode; href: string; icon: LucideIcon; gold?: boolean };

/** Shortcut tiles under the key figures (handoff `.qa`): icon tile, title and a one-line hint. */
export function QuickActions({ items, label = "اختصارات" }: { items: QuickAction[]; label?: string }) {
  const cols = items.length >= 6 ? "sm:grid-cols-3 xl:grid-cols-6" : items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4";
  return (
    <nav aria-label={label}>
      <ul className={cn("grid grid-cols-1 gap-3", cols)}>
        {items.map((a) => {
          const Icon = a.icon;
          return (
            <li key={a.label}>
              <Link href={a.href} className="card-link flex h-full items-center gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-1">
                <span
                  aria-hidden="true"
                  className={cn("flex size-[42px] shrink-0 items-center justify-center rounded-md [&_svg]:size-5", a.gold ? "bg-accent-soft text-accent-ink" : "bg-primary-soft text-primary")}
                >
                  <Icon strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.9375rem] font-bold leading-snug text-ink">{a.label}</span>
                  <span className="block truncate text-xs text-ink-subtle">{a.hint}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
