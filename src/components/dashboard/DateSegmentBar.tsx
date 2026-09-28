import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { SlideSegments } from "@/components/SlideSegments";
import { RUN_SEGMENTS, type RunSegmentId } from "@/data/dashboard";
import { useLocale } from "@/lib/i18n/context";
import { formatDate } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import { DatePickerPopover } from "./DatePickerPopover";

/** Run-segment label key per id. */
const SEGMENT_LABEL_KEY: Record<RunSegmentId, MessageKey> = {
  morning: "runType.morningPickup",
  afternoon: "runType.afternoonDropoff",
};

interface DateSegmentBarProps {
  /** Selected date (YYYY-MM-DD) or null for today. */
  date: string | null;
  onDateChange: (d: string | null) => void;
  segment: RunSegmentId;
  onSegmentChange: (s: RunSegmentId) => void;
}

/**
 * Shared dashboard filter: the date picker chip + the Morning/Afternoon
 * run-segment control. Used by the Live Map FilterBar and Reports (whose
 * toolbar launches the Analytics modal).
 * The segment control is a sliding-thumb segmented control (SlideSegments).
 */
export function DateSegmentBar({
  date,
  onDateChange,
  segment,
  onSegmentChange,
}: DateSegmentBarProps) {
  const { t, locale } = useLocale();
  const [pickerOpen, setPickerOpen] = useState(false);
  const dateRootRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex items-center gap-4">
      {/* Date chip — opens the date picker popover. */}
      <div ref={dateRootRef} className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          aria-label={t("dashboard.selectDate")}
          className="flex h-12 items-center gap-2 rounded border border-dash-outline-variant bg-dash-surface px-3 text-dash-label-md text-dash-on-surface transition-colors hover:border-dash-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
        >
          <Icon name="calendar_today" size={16} variant="outlined" />
          <span>{date ? formatDate(date, locale) : t("dashboard.today")}</span>
          <Icon name="arrow_drop_down" size={16} variant="outlined" />
        </button>
        <DatePickerPopover
          open={pickerOpen}
          value={date}
          onSelect={onDateChange}
          onClose={() => setPickerOpen(false)}
          containRef={dateRootRef}
        />
      </div>

      {/* Run type segmented control — sliding thumb. */}
      <SlideSegments
        variant="dash-box"
        ariaLabel={t("dashboard.runTypeAria")}
        options={RUN_SEGMENTS.map((item) => ({
          id: item.id,
          label: t(SEGMENT_LABEL_KEY[item.id]),
        }))}
        value={segment}
        onChange={onSegmentChange}
      />
    </div>
  );
}
