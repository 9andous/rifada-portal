import Link from "next/link";
import { ListFilter, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Input } from "./field";
import { Select, type SelectOption } from "./select";

export type ToolbarFilter = {
  name: string;
  label: string;
  options: SelectOption[];
  value?: string;
  /** Text of the empty option, e.g. «جميع الأدوار». */
  allLabel: string;
};

/**
 * Search and filter row for list pages. A plain GET form: the state lives in the URL, the list is
 * rendered on the server, and it works without JavaScript. Changing filters returns to page 1.
 */
export function ListToolbar({
  action,
  q,
  searchLabel,
  filters = [],
  keep = {},
  extra,
  hasActive,
}: {
  action: string;
  q?: string;
  searchLabel?: string;
  filters?: ToolbarFilter[];
  /** Params carried over unchanged (sort and direction). */
  keep?: Record<string, string | undefined>;
  extra?: ReactNode;
  hasActive: boolean;
}) {
  return (
    <form method="get" action={action} role="search" className="-mt-1 flex flex-wrap items-center gap-2.5 px-6 pb-4">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {searchLabel ? (
        <div className="flex min-w-60 flex-1 flex-col">
          <label htmlFor="list-q" className="sr-only">
            بحث
          </label>
          <div className="relative">
            <Search aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
            <Input id="list-q" name="q" type="search" defaultValue={q} placeholder={searchLabel} className="ps-9" />
          </div>
        </div>
      ) : null}
      {filters.map((f) => (
        <div key={f.name} className="flex w-48 flex-col">
          <label htmlFor={`list-${f.name}`} className="sr-only">
            {f.label}
          </label>
          <Select id={`list-${f.name}`} name={f.name} defaultValue={f.value ?? ""} placeholder={f.allLabel} options={f.options} />
        </div>
      ))}
      {extra}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="outline">
          <ListFilter aria-hidden="true" strokeWidth={1.75} />
          تطبيق
        </Button>
        {hasActive ? (
          <Link href={action} className={cn("inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-st-bad hover:bg-st-bad-soft")}>
            <X aria-hidden="true" strokeWidth={1.75} className="size-4" />
            مسح التصفية
          </Link>
        ) : null}
      </div>
    </form>
  );
}
