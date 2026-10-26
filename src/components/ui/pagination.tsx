import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { listHref, type SearchParams } from "@/lib/list-params";

/** Page numbers to show: first, last, and a window around the current page, with gaps as null. */
export function pageNumbers(page: number, pageCount: number): (number | null)[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

/** Numbered pagination with a range caption. Previous points to the start side (right in RTL). */
export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  path,
  params,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  path: string;
  params: SearchParams;
}) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const href = (n: number) => listHref(path, params, { page: n === 1 ? undefined : n });
  const cell = "inline-flex h-[34px] min-w-[34px] items-center justify-center rounded-sm border px-2 text-sm font-medium transition-colors";

  return (
    <nav aria-label="التنقل بين الصفحات" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-3.5">
      <p className="t-caption">
        عرض {formatNumber(first)}–{formatNumber(last)} من {formatNumber(total)}
      </p>
      {pageCount > 1 ? (
        <ul className="flex items-center gap-1">
          <li>
            {page > 1 ? (
              <Link href={href(page - 1)} className={cn(cell, "border-line bg-surface text-ink-muted hover:border-primary hover:text-primary")} aria-label="الصفحة السابقة">
                <ChevronRight aria-hidden="true" strokeWidth={1.75} className="size-4" />
              </Link>
            ) : (
              <span className={cn(cell, "border-line text-ink-subtle opacity-40")} aria-hidden="true">
                <ChevronRight strokeWidth={1.75} className="size-4" />
              </span>
            )}
          </li>
          {pageNumbers(page, pageCount).map((n, i) =>
            n === null ? (
              <li key={`gap-${i}`} aria-hidden="true" className={cn(cell, "border-transparent text-ink-subtle")}>
                …
              </li>
            ) : (
              <li key={n}>
                <Link
                  href={href(n)}
                  aria-current={n === page ? "page" : undefined}
                  className={cn(cell, "t-figure", n === page ? "border-band bg-band text-band-ink" : "border-line bg-surface text-ink-muted hover:border-primary hover:text-primary")}
                >
                  {formatNumber(n)}
                </Link>
              </li>
            ),
          )}
          <li>
            {page < pageCount ? (
              <Link href={href(page + 1)} className={cn(cell, "border-line bg-surface text-ink-muted hover:border-primary hover:text-primary")} aria-label="الصفحة التالية">
                <ChevronLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
              </Link>
            ) : (
              <span className={cn(cell, "border-line text-ink-subtle opacity-40")} aria-hidden="true">
                <ChevronLeft strokeWidth={1.75} className="size-4" />
              </span>
            )}
          </li>
        </ul>
      ) : null}
    </nav>
  );
}
