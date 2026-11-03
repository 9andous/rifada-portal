import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Data table in a card: raised header row between hairlines, row hover, tabular digits. */
export function DataTable({ caption, children, minWidth = "48rem" }: { caption: string; children: ReactNode; minWidth?: string }) {
  return (
    // relative: screen-reader-only text inside the table (captions, hidden labels) is positioned
    // against this box, so it scrolls with the table instead of widening the page on phones.
    <div data-table="" className="relative overflow-x-auto">
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
  return <th scope="col" className={cn("relative whitespace-nowrap py-3 pe-4 text-start text-[0.875rem] font-bold text-ink first:ps-6 last:pe-6", className)} {...props} />;
}

/**
 * A table row. With `linked`, the whole row opens the record (owner's review, D-130): the row is the
 * positioning box and the row's one real link (`ROW_LINK`) stretches over it, so a click on any cell
 * follows it while the keyboard still meets a single link per row.
 */
export function Tr({ className, linked, ...props }: HTMLAttributes<HTMLTableRowElement> & { linked?: boolean }) {
  return (
    <tr
      className={cn("border-b border-line/70 transition-colors last:border-0 hover:bg-surface-muted", linked && "relative cursor-pointer", className)}
      {...props}
    />
  );
}

/** Class for the row's main link in a `linked` row: it covers the whole row. */
export const ROW_LINK = "after:absolute after:inset-0 after:content-['']";

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("py-3.5 pe-4 align-middle first:ps-6 last:pe-6", className)} {...props} />;
}
