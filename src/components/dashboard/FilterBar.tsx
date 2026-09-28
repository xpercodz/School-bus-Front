import { Icon } from "@/components/Icon";
import type { RunSegmentId } from "@/data/dashboard";
import { useLocale } from "@/lib/i18n/context";
import { DateSegmentBar } from "./DateSegmentBar";

interface FilterBarProps {
  segment: RunSegmentId;
  onSegmentChange: (s: RunSegmentId) => void;
  /** Selected date (YYYY-MM-DD) or null for today. */
  date: string | null;
  onDateChange: (d: string | null) => void;
  onExport: () => void;
}

/**
 * Sticky filter bar above the Live Map: shared date + run-segment controls and
 * export. The student search / grade / status filters live in the per-list
 * toolbar (`StudentListToolbar`) so the roster controls stay beside the table.
 */
export function FilterBar({
  segment,
  onSegmentChange,
  date,
  onDateChange,
  onExport,
}: FilterBarProps) {
  const { t, dir } = useLocale();
  const ltr = dir === "ltr";

  return (
    <div className="sticky top-16 z-10 border-b border-dash-outline-variant bg-dash-surface-container-low px-4 py-3 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4">
        <DateSegmentBar
          date={date}
          onDateChange={onDateChange}
          segment={segment}
          onSegmentChange={onSegmentChange}
        />

        {/* Export — downloads the current filtered rows as CSV. */}
        <button
          type="button"
          onClick={onExport}
          className={`flex h-12 items-center justify-center gap-2 rounded border border-dash-outline px-4 text-dash-label-md uppercase text-dash-on-surface transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary ${
            ltr ? "tracking-wider" : ""
          }`}
        >
          <Icon name="download" size={16} variant="outlined" />
          <span>{t("dashboard.export")}</span>
        </button>
      </div>
    </div>
  );
}
