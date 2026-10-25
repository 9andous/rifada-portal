import { PageBody } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/surface";

/** Card skeleton for a list: toolbar row and table rows. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="جارٍ تحميل القائمة" className="rounded-sm border border-line bg-surface p-6 shadow-1">
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

/** Loading state for list and detail pages: compact band plus a card skeleton. */
export function CompactPageSkeleton({ form }: { form?: boolean }) {
  return (
    <div aria-busy="true" aria-label="جارٍ التحميل">
      <div className="band-fade bg-band">
        <div className="mx-auto max-w-[1280px] px-6 pb-8 pt-7 lg:px-10">
          <span className="block h-8 w-64 animate-pulse rounded-sm bg-white/10" />
          <span className="mt-4 block h-4 w-96 max-w-full animate-pulse rounded-sm bg-white/10" />
          <div className="mt-7 grid grid-cols-2 gap-6 border-t border-white/12 pt-6 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="block h-14 animate-pulse rounded-sm bg-white/10" />
            ))}
          </div>
        </div>
      </div>
      <PageBody>{form ? <Skeleton className="h-[28rem]" /> : <ListSkeleton />}</PageBody>
    </div>
  );
}
