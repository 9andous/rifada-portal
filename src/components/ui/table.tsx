import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Data table in a card: raised header row between hairlines, row hover, tabular digits. */
export function DataTable({ caption, children, minWidth = "48rem" }: { caption: string; children: ReactNode; minWidth?: string }) {
  return (
    <div data-table="" className="overflow-x-auto">
      <table className="t-table w-full border-collapse" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-y border-line bg-surface-muted">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn("whitespace-nowrap py-3 pe-4 text-start text-[0.8125rem] font-semibold text-ink-muted first:ps-6 last:pe-6", className)} {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-line/70 transition-colors last:border-0 hover:bg-surface-muted", className)} {...props} />;
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("py-3.5 pe-4 align-middle first:ps-6 last:pe-6", className)} {...props} />;
}

/** Class for <SortHeader> so sortable and plain headers line up. */
export const SORT_TH = "first:ps-6 last:pe-6";
