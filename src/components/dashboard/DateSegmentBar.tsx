import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { SlideSegments } from "@/components/SlideSegments";
import { RUN_SEGMENTS, type RunSegmentId } from "@/data/dashboard";
import { fromDateValue, toDateValue } from "@/lib/date-value";
import { useLocale } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/types";

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
 * Shared dashboard filter: the date picker + the Morning/Afternoon
 * run-segment control. Used by the Live Map FilterBar and Reports (whose
 * toolbar launches the Analytics modal).
 *
 * The date control is the Arc date picker in its compact `inline` form: it
 * shrink-wraps in the filter row instead of taking a labelled form field's
 * full width. Today is represented as "no date" (null), so a report keeps
 * following the live day until the director picks one; the picker's Clear
 * action therefore returns to today rather than to an empty field.
 *
 * The two segment labels are long ("Afternoon drop-off"), so the segment
 * control gets its own full-width line whenever the date control leaves it
 * less than a comfortable width — 320–390px phones — and sits beside it only
 * when the labels genuinely fit.
 */
export function DateSegmentBar({
  date,
  onDateChange,
  segment,
  onSegmentChange,
}: DateSegmentBarProps) {
  const { t, locale } = useLocale();

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3">
      <DatePicker
        className="flex-none"
        inline
        hideLabel
        label={t("dashboard.selectDate")}
        placeholder={t("dashboard.today")}
        value={date ? toDateValue(date) : undefined}
        onChange={(next) => onDateChange(next ? fromDateValue(next) : null)}
        locale={locale === "ar" ? "ar-EG" : "en-US"}
        labels={{
          clear: t("dashboard.today"),
          chooseDay: t("datePicker.chooseDay"),
          selected: (formatted) => t("datePicker.selected", { date: formatted }),
          calendar: (label) => t("datePicker.calendar", { label }),
          today: t("dashboard.today"),
          previousMonth: t("dashboard.prevMonth"),
          nextMonth: t("dashboard.nextMonth"),
          todayWithDate: (formatted) => t("datePicker.todayWithDate", { date: formatted }),
        }}
      />

      {/* Run type segmented control — sliding thumb. Full-width on phones. */}
      <div className="min-w-0 flex-1 basis-64 sm:basis-auto sm:flex-none">
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
    </div>
  );
}
