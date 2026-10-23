import { Skeleton, SkeletonText } from "@/components/Skeleton";

/**
 * Dashboard loading skeletons. Each piece mirrors the layout of the component
 * it stands in for, so the loading state does not shift when data lands.
 */

/** Mirrors ManifestSummary: the accounted-for ratio, the proportion bar, three cells. */
function SkeletonSummary() {
  return (
    <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
      <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.6fr)]">
        <div className="border-b border-dash-outline-variant px-4 py-4 sm:px-5 lg:border-b-0 lg:border-e">
          <SkeletonText className="w-36" />
          <Skeleton className="mt-2 h-8 w-24" />
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
          <SkeletonText className="mt-2 w-28" />
        </div>
        <div className="grid grid-cols-3 divide-x divide-dash-outline-variant">
          {[0, 1, 2].map((i) => (
            <div key={i} className="min-w-0 px-2.5 py-3.5 sm:px-5 sm:py-4">
              <SkeletonText className="w-16" />
              <Skeleton className="mt-1.5 h-6 w-10" />
              <SkeletonText className="mt-1.5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mirrors the route rows: name/driver + phone pill, route line, three counts. */
function SkeletonFleet() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SkeletonText className="h-4 w-20" />
        <SkeletonText className="w-24" />
      </div>
      <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="grid grid-cols-1 gap-3 border-b border-dash-outline-variant px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.5fr)_auto_auto] md:items-center md:gap-6"
          >
            <div className="flex min-w-0 items-start justify-between gap-3 md:block">
              <div className="min-w-0">
                <SkeletonText className="h-4 w-24" />
                <SkeletonText className="mt-2 w-28" />
              </div>
              <Skeleton className="h-6 w-20 rounded md:hidden" />
            </div>
            <div className="min-w-0 md:pe-2">
              <div className="flex justify-between gap-2">
                <SkeletonText className="w-24" />
                <SkeletonText className="w-16" />
              </div>
              <Skeleton className="mt-2 h-1 w-full rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-3 md:w-52">
              {[0, 1, 2].map((c) => (
                <div key={c}>
                  <SkeletonText className="h-4 w-5" />
                  <SkeletonText className="mt-1 w-10" />
                </div>
              ))}
            </div>
            <Skeleton className="hidden h-6 w-20 rounded md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Mirrors a data table. `widths` are the per-column skeleton classes so each
 * table's skeleton matches its real column widths. `variant="list"` mirrors the
 * roster's phone composition (identity, then timestamps) instead of a table.
 */
function SkeletonTable({
  widths,
  rows = 6,
  variant = "table",
}: {
  widths: readonly string[];
  rows?: number;
  variant?: "table" | "list";
}) {
  const list = variant === "list";
  const tableRows = Array.from({ length: rows }).map((_, r) => (
    <div
      key={r}
      className="flex h-11 items-center gap-4 border-b border-dash-outline-variant px-4 last:border-0"
    >
      {widths.map((width, c) => (
        <SkeletonText key={c} className={`${c === 0 ? "h-3.5" : ""} ${width}`} />
      ))}
    </div>
  ));

  return (
    <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
      <div
        className={`${list ? "hidden md:flex" : "flex"} items-center gap-4 border-b border-dash-outline-variant px-4 py-3`}
      >
        {widths.map((width, i) => (
          <SkeletonText key={i} className={width} />
        ))}
      </div>
      {list ? (
        <>
          <div className="md:hidden">
            {Array.from({ length: rows }).map((_, r) => (
              <div
                key={r}
                className="border-b border-dash-outline-variant px-4 py-3.5 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <SkeletonText className="h-3.5 w-32" />
                    <SkeletonText className="mt-1.5 w-24" />
                  </div>
                  <div className="flex flex-none items-center gap-1">
                    <Skeleton className="h-5 w-16 rounded" />
                    <Skeleton className="h-11 w-11 rounded-md" />
                  </div>
                </div>
                <SkeletonText className="mt-2 w-44" />
              </div>
            ))}
          </div>
          <div className="hidden md:block">{tableRows}</div>
        </>
      ) : (
        tableRows
      )}
    </div>
  );
}

// Column widths shared by the roster/attendance tables (Live Monitor + Reports).
const ROSTER_COLUMNS = [
  "w-40", // name
  "w-14", // grade
  "w-10", // bus
  "w-20", // boarded at
  "w-20", // dropped at
  "w-16", // status
  "w-16", // history
];

/** Mirrors StudentListToolbar: search + grade row, then the status chip rail. */
function SkeletonToolbar() {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      <div className="flex items-center gap-2 md:contents">
        <Skeleton className="h-11 min-w-0 flex-1 rounded-md md:order-1 md:h-9 md:w-56 md:flex-none" />
        <Skeleton className="h-11 w-24 flex-none rounded-md md:order-3 md:h-9" />
      </div>
      <div className="flex min-w-0 items-center gap-2 md:contents">
        <Skeleton className="h-11 min-w-0 flex-1 rounded-md md:order-2 md:h-9 md:w-64 md:flex-none" />
      </div>
    </div>
  );
}

/** Live monitor loading state: summary block + route rows + roster. */
export function LiveMapSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonSummary />
      <SkeletonFleet />
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SkeletonText className="h-4 w-32" />
          <SkeletonText className="w-16" />
        </div>
        <SkeletonToolbar />
        <SkeletonTable widths={ROSTER_COLUMNS} variant="list" />
      </div>
    </div>
  );
}

/** Reports loading state: KPIs, by-bus, by-grade, roster. */
export function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`border-dash-outline-variant ${[
              "border-e border-b sm:border-b-0",
              "border-b sm:border-b-0 sm:border-e",
              "border-e",
              "",
            ][i]}`}
          >
            <div className="min-w-0 px-2.5 py-3.5 sm:px-5 sm:py-4">
              <SkeletonText className="w-16" />
              <Skeleton className="mt-1.5 h-6 w-10" />
              <SkeletonText className="mt-1.5 w-20" />
            </div>
          </div>
        ))}
      </div>
      <SkeletonText className="h-4 w-40" />
      <SkeletonTable widths={["w-24", "w-8", "w-8", "w-8", "w-8", "w-12"]} rows={4} />
      <SkeletonText className="h-4 w-40" />
      <SkeletonTable widths={["w-24", "w-8", "w-8", "w-8", "w-8"]} rows={4} />
      <SkeletonText className="h-4 w-40" />
      <SkeletonTable widths={ROSTER_COLUMNS} variant="list" />
    </div>
  );
}

/** Assignments loading state: a Drivers table skeleton + a Students table skeleton. */
export function AssignmentsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonText className="h-4 w-40" />
      <SkeletonTable widths={["w-24", "w-40", "w-24"]} rows={4} />
      <SkeletonText className="h-4 w-40" />
      <SkeletonTable widths={["w-48", "w-16", "w-24"]} rows={6} />
    </div>
  );
}

/** Drivers loading state: an add-driver form card + an access-codes table skeleton. */
export function DriversSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonText className="h-4 w-40" />
      <div className="rounded-lg border border-dash-outline-variant bg-dash-surface p-4">
        <SkeletonText className="h-3.5 w-24" />
        <Skeleton className="mt-3 h-9 w-full rounded-md" />
        <Skeleton className="mt-3 h-9 w-44 rounded-md" />
      </div>
      <SkeletonText className="h-4 w-40" />
      <SkeletonTable widths={["w-40", "w-24", "w-40"]} rows={4} />
    </div>
  );
}
