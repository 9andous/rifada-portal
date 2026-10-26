import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArchOutline, Diamond } from "@/components/brand/arch";
import { cn } from "@/lib/cn";
import { Breadcrumbs } from "./breadcrumbs";
import { figureIcon } from "./figure-icons";

/**
 * Page head (docs/DESIGN.md: Page head): white, under the green navigation bar. Breadcrumbs, an
 * eyebrow with a gold diamond, the page title in brand green, optional lead text and actions, and a
 * faint ogee arch at the end. Key figures follow below it on the page canvas.
 *
 * The component keeps its historical name; content written for the green band (on-band colours)
 * is remapped to ink colours by `.page-head`.
 */
export function PageBand({
  title,
  eyebrow,
  lead,
  actions,
  figures,
  compact,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  /** Key figures row, usually <BandFigures>. */
  figures?: ReactNode;
  /** Smaller head for list and detail pages so data stays above the fold. */
  compact?: boolean;
}) {
  return (
    <section aria-labelledby="page-title" data-print="hide" className="page-head">
      <div className="relative overflow-hidden border-b border-line bg-surface">
        <ArchOutline className="absolute -bottom-2.5 end-8 hidden h-[calc(100%-2px)] max-h-56 w-auto text-band opacity-[0.07] sm:block dark:text-accent" />
        <div className={cn("fade-up relative mx-auto max-w-[1360px] px-4 sm:px-8", compact ? "pb-6 pt-5" : "pb-7 pt-6")}>
          <Suspense fallback={null}>
            <Breadcrumbs current={typeof title === "string" ? title : undefined} />
          </Suspense>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="min-w-0 max-w-3xl">
              {eyebrow ? (
                <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-accent-ink">
                  <Diamond />
                  {eyebrow}
                </div>
              ) : null}
              <h1 id="page-title" className={cn("t-page text-brand-ink", compact ? "text-[1.625rem]" : "text-[2rem]")}>
                {title}
              </h1>
              {lead ? <p className="mt-1.5 max-w-[680px] text-[0.9375rem] leading-relaxed text-ink-muted">{lead}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2 lg:me-44">{actions}</div> : null}
          </div>
        </div>
      </div>
      {figures ? <div className="fade-up mx-auto max-w-[1360px] px-4 pt-6 sm:px-8">{figures}</div> : null}
    </section>
  );
}

export type BandFigure = {
  label: string;
  /** Pre-formatted value (Arabic-Indic digits); a dash when there is no data. */
  value: ReactNode;
  unit?: string;
  caption?: ReactNode;
  /** Lucide icon element for the card's icon tile. */
  icon?: ReactNode;
  /** Tint of the icon tile. */
  tone?: "green" | "gold" | "info" | "warn" | "bad" | "ok";
  /** Makes the card a link to the matching filtered list. */
  href?: string;
  /** Needs attention: the icon tile turns gold and a marker shows before the caption. */
  emphasis?: boolean;
};

const TONE: Record<NonNullable<BandFigure["tone"]>, string> = {
  green: "bg-primary-soft text-primary",
  gold: "bg-accent-soft text-accent-ink",
  info: "bg-st-info-soft text-st-info",
  warn: "bg-st-warn-soft text-st-warn",
  bad: "bg-st-bad-soft text-st-bad",
  ok: "bg-st-ok-soft text-st-ok",
};

/**
 * Key figures as cards (design handoff `.kpi`): icon tile and label, the figure, a caption. The
 * first card is the featured green card with an arch outline; cards with an href link to a list.
 */
export function BandFigures({ items }: { items: BandFigure[] }) {
  const cols =
    items.length >= 6 ? "xl:grid-cols-6" : items.length === 5 ? "xl:grid-cols-5" : items.length === 3 ? "sm:grid-cols-3" : "xl:grid-cols-4";
  return (
    <dl className={cn("grid grid-cols-2 gap-3.5", items.length === 3 ? cols : cn("sm:grid-cols-3", cols))}>
      {items.map((f, i) => {
        const featured = i === 0;
        return (
          <div
            key={f.label}
            className={cn(
              "group relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border px-[18px] py-4 shadow-1 transition-[border-color,box-shadow,background-color]",
              featured ? "band-scope border-band bg-band" : "border-line bg-surface",
              f.href && (featured ? "hover:bg-band-2" : "hover:border-primary hover:shadow-2"),
            )}
          >
            {featured ? <ArchOutline strokeWidth={6} inner="transparent" className="absolute -bottom-16 -end-8 w-[140px] text-band-gold/20" /> : null}
            <dt className="relative flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-[38px] shrink-0 items-center justify-center rounded-md [&_svg]:size-5",
                  featured ? "bg-white/10 text-band-gold" : f.emphasis ? TONE.gold : TONE[f.tone ?? "green"],
                )}
              >
                {f.icon ?? figureIcon(f.label) ?? <span className="size-2 rotate-45 bg-current" />}
              </span>
              <span className={cn("min-w-0 truncate text-[0.875rem] font-medium", featured ? "text-band-ink-muted" : "text-ink-muted")}>{f.label}</span>
              {f.href ? (
                <ChevronLeft aria-hidden="true" className={cn("ms-auto size-4 shrink-0", featured ? "text-band-ink-muted" : "text-ink-subtle group-hover:text-primary")} />
              ) : null}
            </dt>
            <dd className="relative flex items-baseline gap-1">
              <span className={cn("t-figure text-[2rem] leading-none", featured ? "text-band-ink" : "text-ink")}>{f.value}</span>
              {f.unit ? <span className={cn("text-sm font-medium", featured ? "text-band-ink-muted" : "text-ink-subtle")}>{f.unit}</span> : null}
            </dd>
            {f.caption ? (
              <dd className={cn("relative flex items-center gap-1.5 text-xs", featured ? "text-band-ink-muted" : "text-ink-subtle")}>
                {f.emphasis ? <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", featured ? "bg-band-gold" : "bg-accent")} /> : null}
                {f.caption}
              </dd>
            ) : null}
            {f.href ? (
              <Link href={f.href} className="absolute inset-0 z-10 rounded-xl focus-visible:outline-offset-[-3px]">
                <span className="sr-only">عرض {f.label}</span>
              </Link>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}
