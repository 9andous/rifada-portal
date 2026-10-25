import { Check } from "lucide-react";
import { OBJECTIVE_NUMBERS } from "@/lib/taxonomy-source";
import { toArabicDigits } from "@/lib/format";
import { cn } from "@/lib/cn";

// The 7-column objective grid of the source tables: one column per strategic objective, numbered
// 1 to 7 from the start edge as in the PDF. Header and cells share widths so columns line up.

export function ObjectiveHeaderCells({ objectives }: { objectives: { number: number; title: string }[] }) {
  const titles = new Map(objectives.map((o) => [o.number, o.title]));
  return OBJECTIVE_NUMBERS.map((n) => (
    <th key={n} scope="col" title={titles.get(n)} className="w-10 px-0 py-2.5 text-center">
      <span className="t-label">{toArabicDigits(n)}</span>
      <span className="sr-only">: {titles.get(n)}</span>
    </th>
  ));
}

export function ObjectiveCells({ linked, uncertain = [] }: { linked: readonly number[]; uncertain?: readonly number[] }) {
  return OBJECTIVE_NUMBERS.map((n) => {
    const isLinked = linked.includes(n);
    const isUncertain = uncertain.includes(n);
    return (
      <td key={n} className={cn("px-0 py-2 text-center", isUncertain && "bg-st-warn-soft outline-2 -outline-offset-2 outline-st-warn")}>
        {isLinked ? (
          <span className="inline-flex size-5 items-center justify-center rounded-sm bg-primary-soft text-primary-soft-ink print:border print:border-ink">
            <Check strokeWidth={2.5} className="size-3.5" aria-hidden="true" />
            <span className="sr-only">مرتبطة بالهدف {toArabicDigits(n)}</span>
          </span>
        ) : (
          <span className="sr-only">غير مرتبطة بالهدف {toArabicDigits(n)}</span>
        )}
        {isUncertain ? <span className="sr-only">، خلية غير مؤكدة</span> : null}
      </td>
    );
  });
}

/** Legend of the seven strategic objectives used as column headers. */
export function ObjectiveLegend({ objectives, className }: { objectives: { number: number; title: string }[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col gap-2.5", className)}>
      {objectives.map((o) => (
        <li key={o.number} className="grid grid-cols-[1.5rem_1fr] gap-2 text-sm leading-relaxed">
          <span className="t-figure text-accent-ink">{toArabicDigits(o.number)}</span>
          <span className="text-ink-muted">{o.title}</span>
        </li>
      ))}
    </ol>
  );
}
