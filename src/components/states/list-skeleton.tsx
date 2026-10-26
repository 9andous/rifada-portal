import { HeadSkeleton, PageBody } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/surface";

/** Card skeleton for a list: toolbar row and table rows. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="جارٍ تحميل القائمة" className="rounded-xl border border-line bg-surface p-6 shadow-1">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 min-w-60 flex-1" />
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-20" />
      </div>
      <Skeleton className="mt-6 h-9" />
      <div className="mt-2 flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-11" />
        ))}
      </div>
    </div>
  );
}

/** Loading state for list and detail pages: compact head plus a card skeleton. */
export function CompactPageSkeleton({ form }: { form?: boolean }) {
  return (
    <div aria-busy="true" aria-label="جارٍ التحميل">
      <HeadSkeleton compact figures={form ? 0 : 4} />
      <PageBody>{form ? <Skeleton className="h-[28rem] rounded-xl" /> : <ListSkeleton />}</PageBody>
    </div>
  );
}
