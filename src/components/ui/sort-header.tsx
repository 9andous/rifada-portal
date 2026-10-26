import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { listHref, type SearchParams, type SortDir } from "@/lib/list-params";

/** Column header that sorts the list by this column; a second click reverses the direction. */
export function SortHeader({
  label,
  column,
  current,
  dir,
  path,
  params,
  className,
}: {
  label: string;
  column: string;
  current: string;
  dir: SortDir;
  path: string;
  params: SearchParams;
  className?: string;
}) {
  const active = current === column;
  const nextDir: SortDir = active && dir === "asc" ? "desc" : "asc";
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined} className={cn("whitespace-nowrap py-3 pe-4 text-start text-[0.8125rem] font-semibold text-ink-muted", className)}>
      <Link
        href={listHref(path, params, { sort: column, dir: nextDir, page: undefined })}
        scroll={false}
        className={cn("inline-flex items-center gap-1.5 hover:text-primary", active && "text-primary")}
      >
        {label}
        <Icon aria-hidden="true" strokeWidth={1.75} className={cn("size-3.5", !active && "opacity-50")} />
        <span className="sr-only">{active ? (dir === "asc" ? "، مرتب تصاعديًا" : "، مرتب تنازليًا") : "، اضغط للترتيب"}</span>
      </Link>
    </th>
  );
}
