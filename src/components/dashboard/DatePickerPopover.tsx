import { useEffect, useState, type RefObject } from "react";
import { Icon } from "@/components/Icon";
import type { Locale } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/context";
import { formatDate, toLocaleDigits } from "@/lib/i18n/format";

// ── date helpers (local "YYYY-MM-DD", timezone-safe) ─────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Today as a local "YYYY-MM-DD" (matches todayDateStr in school-data). */
function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseDateStr(value: string | null): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

// ── localized labels via Intl (same en-US / ar-EG pairing as i18n/format.ts) ──

const monthFormatters = new Map<string, Intl.DateTimeFormat>();
function monthLabel(year: number, month: number, locale: Locale): string {
  const code = locale === "ar" ? "ar-EG" : "en-US";
  let fmt = monthFormatters.get(code);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(code, { month: "long", year: "numeric" });
    monthFormatters.set(code, fmt);
  }
  return fmt.format(new Date(year, month, 1));
}

const weekdayFormatters = new Map<string, Intl.DateTimeFormat>();
function weekdayLabel(offset: number, locale: Locale): string {
  const code = locale === "ar" ? "ar-EG" : "en-US";
  let fmt = weekdayFormatters.get(code);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(code, { weekday: "short" });
    weekdayFormatters.set(code, fmt);
  }
  // 2026-01-04 is a Sunday — the anchor for the first (Sunday) column.
  return fmt.format(new Date(2026, 0, 4 + offset));
}

/** One month as a Sunday-first week of day cells (null = leading/trailing blank). */
function buildMonthCells(year: number, month: number): (number | null)[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay(); // 0 = Sunday
  const cells: (number | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface DatePickerPopoverProps {
  open: boolean;
  /** Selected date (YYYY-MM-DD), or null for today. */
  value: string | null;
  onSelect: (date: string | null) => void;
  onClose: () => void;
  /**
   * The container that also holds the trigger button. Outside clicks (including
   * on the trigger itself) are ignored for closing, so the chip's own onClick
   * can toggle cleanly instead of closing-then-reopening via the mousedown
   * listener.
   */
  containRef: RefObject<HTMLDivElement | null>;
}

/**
 * Anchored popover under the filter bar's date chip: a custom Material 3
 * calendar matching the dashboard UI — not the browser's native picker. Month /
 * weekday names and day digits localize via Intl (Arabic reads right-to-left
 * and uses Eastern Arabic numerals). Closes on outside click / Escape.
 */
export function DatePickerPopover({
  open,
  value,
  onSelect,
  onClose,
  containRef,
}: DatePickerPopoverProps) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containRef.current && !containRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, containRef]);

  // The calendar mounts only while open, so its displayed month is re-seeded
  // from the current value (or today) on every open — no reset effect needed.
  if (!open) return null;
  return <Calendar value={value} onSelect={onSelect} onClose={onClose} />;
}

function Calendar({
  value,
  onSelect,
  onClose,
}: {
  value: string | null;
  onSelect: (date: string | null) => void;
  onClose: () => void;
}) {
  const { t, locale, dir } = useLocale();
  const today = todayDateStr();
  const [view, setView] = useState(() => {
    const v = parseDateStr(value) ?? parseDateStr(todayDateStr())!;
    return { year: v.year, month: v.month };
  });

  const cells = buildMonthCells(view.year, view.month);
  // Arrows point outward — mirror in RTL so "previous" still reads leftward.
  const prevIcon = dir === "rtl" ? "chevron_right" : "chevron_left";
  const nextIcon = dir === "rtl" ? "chevron_left" : "chevron_right";
  const shiftMonth = (delta: number) =>
    setView((v) => {
      const month = v.month + delta;
      if (month < 0) return { year: v.year - 1, month: 11 };
      if (month > 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month };
    });

  const navButtonClass =
    "press flex h-11 w-11 items-center justify-center rounded text-dash-on-surface-variant hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary sm:h-9 sm:w-9";

  return (
    <div
      role="dialog"
      aria-label={t("dashboard.selectDate")}
      className="absolute start-0 top-full z-20 mt-2 flex max-h-[70dvh] w-[min(20rem,calc(100vw_-_2rem))] flex-col gap-3 overflow-y-auto overscroll-contain rounded-lg border border-dash-outline-variant bg-dash-surface p-3 shadow-card sm:p-4"
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t("dashboard.prevMonth")}
          onClick={() => shiftMonth(-1)}
          className={navButtonClass}
        >
          <Icon name={prevIcon} size={20} variant="outlined" />
        </button>
        <span className="text-[12.5px] font-medium text-dash-on-surface">
          {monthLabel(view.year, view.month, locale)}
        </span>
        <button
          type="button"
          aria-label={t("dashboard.nextMonth")}
          onClick={() => shiftMonth(1)}
          className={navButtonClass}
        >
          <Icon name={nextIcon} size={20} variant="outlined" />
        </button>
      </div>

      {/* The 7-column grid runs a little wider than the padded content at
          phone sizes so each day stays a 40px+ target inside the capped
          popover width: 40px cells even at a 320px viewport. */}
      <div className="-mx-2 flex flex-col gap-3 sm:mx-0">
        {/* Weekday header — first column is Sunday; flows right-to-left in Arabic. */}
        <div className="grid grid-cols-7">
          {Array.from({ length: 7 }, (_, offset) => (
            <div
              key={offset}
              className="flex h-7 items-center justify-center text-[11px] text-dash-on-surface-variant"
            >
              {weekdayLabel(offset, locale)}
            </div>
          ))}
        </div>

        {/* Day grid. 40px cells on phones; nav buttons are 44px. */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, index) => {
            if (day === null) return <span key={index} className="h-11 sm:h-9" aria-hidden="true" />;
            const dateStr = toDateStr(view.year, view.month, day);
            const isSelected = dateStr === value;
            const isToday = dateStr === today;
            const cellClass = [
              "press flex h-11 w-full items-center justify-center rounded text-dash-body-sm sm:h-9",
              isSelected
                ? "bg-dash-on-surface font-medium text-dash-background"
                : isToday
                  ? "font-semibold text-dash-primary ring-1 ring-dash-primary"
                  : "text-dash-on-surface hover:bg-dash-surface-container-high",
            ].join(" ");
            return (
              <button
                key={index}
                type="button"
                aria-pressed={isSelected}
                aria-label={formatDate(dateStr, locale)}
                onClick={() => {
                  onSelect(dateStr);
                  onClose();
                }}
                className={cellClass}
              >
                {toLocaleDigits(String(day), locale)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Today reset */}
      <button
        type="button"
        onClick={() => {
          onSelect(null);
          onClose();
        }}
        className="press flex h-11 items-center justify-center gap-2 rounded text-dash-label-md text-dash-primary hover:bg-dash-primary-container/40 sm:h-10"
      >
        {t("dashboard.today")}
        {value && (
          <span className="text-dash-on-surface-variant">
            ({formatDate(value, locale)})
          </span>
        )}
      </button>
    </div>
  );
}
