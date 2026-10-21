import { Skeleton } from "@/components/Skeleton";

/**
 * Mobile roster loading skeleton. Mirrors the real screen from top to bottom:
 * summary strip, search bar, filter tabs, then roster rows (name/grade + status
 * pill + "⋯" button). Wrap in `role="status"` at the call site.
 */
export function RosterSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {/* Summary strip */}
      <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="grid grid-cols-4 divide-x divide-outline-variant">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-2 py-3 text-center">
              <Skeleton className="mx-auto h-4 w-6" />
              <Skeleton className="mx-auto mt-2 h-3 w-12" />
            </div>
          ))}
        </div>
        <Skeleton className="h-1.5 w-full rounded-none" />
      </div>
      {/* Search */}
      <Skeleton className="h-11 w-full rounded-md" />
      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-outline-variant pb-0">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 flex-1 rounded-none" />
        ))}
      </div>
      {/* Roster rows */}
      <ul className="divide-y divide-outline-variant overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="flex items-center gap-2 px-3 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mirrors the shared history sheet's list rows (date + run line, status badge). */
export function HistoryListSkeleton() {
  return (
    // Padding comes from the sheet's scroll container.
    <div className="divide-y divide-outline-variant">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-7 w-20 flex-shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}
