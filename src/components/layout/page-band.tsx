import type { ReactNode } from "react";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { cn } from "@/lib/cn";

/** Height of the navigation row in the app shell; the page band continues the pattern below it. */
export const NAV_HEIGHT = 72;

/**
 * The lower part of the green band (docs/DESIGN.md: Green band): eyebrow, page title with a short
 * gold rule, optional lead text and actions, and optional key figures. It continues the navigation
 * row seamlessly and fades softly into the ivory page. Nothing overlaps it.
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
  /** Smaller band for list and detail pages so data stays above the fold. */
  compact?: boolean;
}) {
  return (
    <section aria-labelledby="page-title" data-print="hide" className="relative">
      <div className="band-fade relative overflow-hidden bg-band text-on-band">
        <GeometricPattern offsetY={NAV_HEIGHT} />
        <div className={cn("relative mx-auto max-w-[1280px] px-6 lg:px-10", compact ? "pb-8 pt-7" : "pb-10 pt-10")}>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0 max-w-3xl">
              {eyebrow ? <div className="mb-2 text-sm text-gold-on-band">{eyebrow}</div> : null}
              <h1 id="page-title" className={cn("t-page text-on-band", compact && "text-[1.625rem]")}>
                {title}
              </h1>
              <span aria-hidden="true" className="mt-3 block h-[2px] w-12 bg-gold-on-band" />
              {lead ? <p className="mt-3 text-[0.9375rem] leading-relaxed text-on-band-muted">{lead}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>
          {figures ? <div className={compact ? "mt-7" : "mt-10"}>{figures}</div> : null}
        </div>
      </div>
    </section>
  );
}

export type BandFigure = {
  label: string;
  /** Pre-formatted value (Arabic-Indic digits); a dash when there is no data. */
  value: ReactNode;
  unit?: string;
  caption?: ReactNode;
  /** Key figure in gold. */
  emphasis?: boolean;
};

/** Key figures in one hairline-separated row (element taken from direction A). */
export function BandFigures({ items }: { items: BandFigure[] }) {
  return (
    <dl className="grid grid-cols-2 gap-y-6 border-t border-white/12 pt-6 sm:grid-cols-3 xl:flex xl:flex-wrap">
      {items.map((f, i) => (
        <div key={f.label} className={cn("min-w-36 pe-8 xl:flex-1", i > 0 && "xl:border-s xl:border-white/12 xl:ps-8")}>
          <dt className="text-[0.8125rem] font-semibold text-on-band-muted">{f.label}</dt>
          <dd className="mt-2 flex items-baseline gap-1.5">
            <span className={cn("t-figure text-[2.5rem]", f.emphasis ? "text-gold-on-band" : "text-on-band")}>{f.value}</span>
            {f.unit ? <span className="text-sm text-on-band-muted">{f.unit}</span> : null}
          </dd>
          {f.caption ? <dd className="mt-1.5 text-xs text-on-band-muted">{f.caption}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
