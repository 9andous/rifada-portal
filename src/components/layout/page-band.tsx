import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArchOutline, Diamond } from "@/components/brand/arch";
import { cn } from "@/lib/cn";
import { Breadcrumbs } from "./breadcrumbs";

/**
 * Page head (docs/DESIGN.md: Page head): white, under the green navigation bar. Breadcrumbs, an
 * eyebrow with a gold diamond, the page title in brand green, optional lead text and actions, and a
 * faint ogee arch at the end. The head spans the full width like the header (D-095); key figures
 * follow below it on the page canvas, centred at 1360px with the page body.
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
        <div className={cn("fade-up relative px-4 sm:px-8", compact ? "pb-6 pt-5" : "pb-7 pt-6")}>
          <Suspense fallback={null}>
            <Breadcrumbs current={typeof title === "string" ? title : undefined} />
          </Suspense>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="min-w-0 max-w-4xl">
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
      {figures ? <div className="fade-up fade-up-1 mx-auto max-w-[1360px] px-4 pt-6 sm:px-8">{figures}</div> : null}
    </section>
  );
}

export type BandFigure = {
  label: string;
  /** Pre-formatted value (Arabic-Indic digits); a dash when there is no data. */
  value: ReactNode;
  unit?: string;
  caption?: ReactNode;
  /** Makes the card a link to the matching filtered list. */
  href?: string;
  /** The figure needs attention: it takes the status colour and a dot marks the caption. */
  attention?: FigureAttention | false;
};

export type FigureAttention = "warn" | "bad";

/** Key-figure tile (docs/DESIGN.md: Key figures), shared with the request list's status filters. */
export const FIGURE_TILE = "card-hover group relative flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-xl border border-line bg-surface px-[18px] py-4 shadow-1";
export const FIGURE_VALUE = "t-figure text-[2rem] leading-none";
export const ATTENTION_TEXT: Record<FigureAttention, string> = { warn: "text-st-warn", bad: "text-st-bad" };
const ATTENTION_DOT: Record<FigureAttention, string> = { warn: "bg-st-warn", bad: "bg-st-bad" };

/** Arrow of a linked tile: hidden at rest, shown on hover and keyboard focus. */
export function FigureChevron() {
  return (
    <ChevronLeft
      aria-hidden="true"
      strokeWidth={1.75}
      className="ms-auto size-4 shrink-0 text-primary opacity-0 transition-[opacity,translate] group-focus-within:opacity-100 group-hover:-translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-accent"
    />
  );
}

/**
 * Key figures as cards: label, the figure, a caption. All tiles share one style; colour appears
 * only when a figure needs attention. Tiles with an href link to the matching list.
 */
export function BandFigures({ items }: { items: BandFigure[] }) {
  const cols =
    items.length >= 6 ? "xl:grid-cols-6" : items.length === 5 ? "xl:grid-cols-5" : items.length === 3 ? "sm:grid-cols-3" : "xl:grid-cols-4";
  return (
    <dl className={cn("grid grid-cols-2 gap-3.5", items.length === 3 ? cols : cn("sm:grid-cols-3", cols))}>
      {items.map((f) => (
        <div key={f.label} className={cn(FIGURE_TILE, f.href && "card-link")}>
          <dt className="flex items-center gap-2">
            <span className="min-w-0 truncate text-[0.875rem] font-medium text-ink-muted">{f.label}</span>
            {f.href ? <FigureChevron /> : null}
          </dt>
          <dd className="flex items-baseline gap-1">
            <span className={cn(FIGURE_VALUE, f.attention ? ATTENTION_TEXT[f.attention] : "text-ink")}>{f.value}</span>
            {f.unit ? <span className="text-sm font-medium text-ink-subtle">{f.unit}</span> : null}
          </dd>
          {f.caption ? (
            <dd className="flex items-center gap-1.5 text-xs text-ink-subtle">
              {f.attention ? <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", ATTENTION_DOT[f.attention])} /> : null}
              {f.caption}
            </dd>
          ) : null}
          {f.href ? (
            <Link href={f.href} className="absolute inset-0 z-10 rounded-xl">
              <span className="sr-only">عرض {f.label}</span>
            </Link>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
