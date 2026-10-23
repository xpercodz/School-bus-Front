import type { RunSegmentId } from "@/data/dashboard";
import { DateSegmentBar } from "./DateSegmentBar";

interface FilterBarProps {
  segment: RunSegmentId;
  onSegmentChange: (s: RunSegmentId) => void;
  /** Selected date (YYYY-MM-DD) or null for today. */
  date: string | null;
  onDateChange: (d: string | null) => void;
}

/**
 * Sticky scope row: date, run segment and export. The roster's own search,
 * grade and status filters stay in the list toolbar, beside the rows they
 * narrow.
 */
export function FilterBar({
  segment,
  onSegmentChange,
  date,
  onDateChange,
}: FilterBarProps) {
  return (
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b border-dash-outline-variant bg-dash-background px-4 py-2.5 sm:px-6 lg:top-0">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-3">
        <DateSegmentBar
          date={date}
          onDateChange={onDateChange}
          segment={segment}
          onSegmentChange={onSegmentChange}
        />
      </div>
    </div>
  );
}
