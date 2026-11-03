import { formatNumber, toArabicDigits } from "@/lib/format";

export type DonutSlice = { label: string; value: number };

// Chart tokens in order (src/styles/tokens.css); they switch with the theme.
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

const R = 15.915; // circumference 100, so a slice's dash length is its share in percent
const STROKE = 6;

/**
 * A ring chart with the total in the middle and a legend of figures and shares (owner's review,
 * D-130: «المستخدمون حسب الدور»). Pure SVG on the server; the legend carries every figure, so the
 * picture itself is hidden from screen readers.
 */
export function DonutChart({ slices, totalLabel }: { slices: DonutSlice[]; totalLabel: string }) {
  const total = slices.reduce((n, s) => n + s.value, 0);
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-6 px-6 pb-6 sm:flex-row sm:items-center">
      <div className="relative size-44 shrink-0">
        <svg viewBox="0 0 42 42" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="21" cy="21" r={R} fill="none" stroke="var(--chart-track)" strokeWidth={STROKE} />
          {total > 0
            ? slices.map((s, i) => {
                const share = (s.value / total) * 100;
                const dash = (
                  <circle
                    key={s.label}
                    cx="21"
                    cy="21"
                    r={R}
                    fill="none"
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={STROKE}
                    strokeDasharray={`${share} ${100 - share}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += share;
                return s.value > 0 ? dash : null;
              })
            : null}
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="t-figure text-3xl font-bold text-ink">{formatNumber(total)}</span>
          <span className="t-caption">{totalLabel}</span>
        </span>
      </div>
      <ul className="flex w-full flex-col gap-2.5">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            <span aria-hidden="true" className="size-3 shrink-0 rounded-[3px]" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="min-w-0 flex-1 text-ink-muted">{s.label}</span>
            <span className="t-figure font-bold text-ink">{formatNumber(s.value)}</span>
            <span className="t-caption w-10 text-end">{total ? `${toArabicDigits(Math.round((s.value / total) * 100))}٪` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
