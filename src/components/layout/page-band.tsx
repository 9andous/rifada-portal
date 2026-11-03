import { ChevronLeft, type LucideIcon } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { ArchOutline, Diamond } from "@/components/brand/arch";
import { KpiRow, type KpiTone } from "@/components/dashboard/kpis";
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
  icon: LucideIcon;
  /** Colour of the icon tile; defaults to the attention tone, else primary. */
  tone?: KpiTone;
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
/** A figure card's shape; its colours come from `FIGURE_TILE` (white) or `FIGURE_LEAD` (green). */
export const FIGURE_SHAPE = "group relative flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-xl border px-[18px] py-4 shadow-1";
export const FIGURE_TILE = `${FIGURE_SHAPE} card-hover border-line bg-surface`;
export const FIGURE_VALUE = "t-figure text-[2rem] leading-none";
/** The green lead or chosen figure (D-130), as the first KPI card. Use instead of `FIGURE_TILE`. */
export const FIGURE_LEAD = `${FIGURE_SHAPE} band-scope border-band bg-band text-band-ink`;
export const ATTENTION_TEXT: Record<FigureAttention, string> = { warn: "text-st-warn", bad: "text-st-bad" };
/** Arrow of a linked tile: hidden at rest, shown on hover and keyboard focus. */
export function FigureChevron() {
  return (
    <ChevronLeft
      aria-hidden="true"
      strokeWidth={1.75}
      className="ms-auto size-4 shrink-0 text-primary opacity-0 [.band-scope_&]:text-band-ink transition-[opacity,translate] group-focus-within:opacity-100 group-hover:-translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-accent"
    />
  );
}

/**
 * Key figures of list and detail pages, drawn as the dashboards' cards (<KpiRow>: icon tile, label,
 * figure, caption) so every page shows figures one way (owner's review, D-132). The first tile is
 * green (D-130); a figure needing attention takes its status colour. Tiles with an href link to the
 * matching list.
 */
export function BandFigures({ items }: { items: BandFigure[] }) {
  return (
    <KpiRow
      items={items.map((f, i) => ({
        label: f.label,
        icon: f.icon,
        tone: f.attention || f.tone,
        alert: Boolean(f.attention),
        value: f.value,
        unit: f.unit,
        caption: f.caption,
        href: f.href,
        featured: i === 0,
      }))}
    />
  );
}
