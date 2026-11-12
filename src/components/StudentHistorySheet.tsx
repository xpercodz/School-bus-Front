import { useMemo, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/arc/button/button";
import { Calendar, useToday } from "@/components/arc/calendar/calendar";
import { Icon } from "@/components/Icon";
import { HistoryListSkeleton } from "@/components/RosterSkeleton";
import { DASH_STATUS_META, STATUS_DOT } from "@/data/dashboard";
import { useStudentHistoryByDay } from "@/lib/school-data";
import type { HistoryDayEntry } from "@/lib/school-data";
import { fromDateValue, toDateValue } from "@/lib/date-value";
import { useLocale } from "@/lib/i18n/context";
import {
  formatDate,
  statusKey,
  toLocaleDigits,
  translateDataLabel,
} from "@/lib/i18n/format";

interface StudentHistorySheetProps {
  /** Student to show history for; null (or closed) hides the sheet. */
  studentName: string | null;
  onClose: () => void;
}

/** First day of a date's month — the Arc calendar always speaks in month starts. */
function monthStartOf(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The run's clock time: boarded for the pickup, dropped off for the drop-off. */
function entryTime(entry: HistoryDayEntry): string | null {
  return entry.boardedAt ?? entry.droppedOffAt;
}

/**
 * Attendance history for one student, shared by the dashboard row action and the
 * mobile kebab menu.
 *
 * It is a **calendar**, not a list: the left column marks which days even have a
 * record, and the right column shows the day the calendar points at. Availability
 * is encoded by the calendar itself — a day with records is selectable, a day
 * without is greyed out and disabled — so the legend below it names the two
 * states and nothing had to be patched into the vendored calendar.
 *
 * Locale labels: `boardedAt`/`droppedOffAt` already arrive locale-formatted from
 * `useStudentHistoryByDay`; the digits are passed through `toLocaleDigits` once
 * more because it is idempotent and keeps this file to one formatting path.
 */
export function StudentHistorySheet({
  studentName,
  onClose,
}: StudentHistorySheetProps) {
  const { t } = useLocale();
  const open = studentName !== null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={studentName ?? t("history.title")}
      // Bottom sheet on a phone, centered dialog from `sm` up — the two-column
      // body needs the width, and the phone keeps the thumb-reachable sheet.
      placement="auto"
      // Closing sets studentName to null, which unmounts the whole body; an exit
      // beat would animate an empty panel out. Close instantly.
      exitAnimation={false}
      panelClassName="w-full max-h-[88dvh] rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] sm:max-w-[880px] sm:rounded-xl"
    >
      {studentName !== null && (
        // Keyed so picking a day never leaks into the next student's sheet.
        <StudentHistoryCalendar
          key={studentName}
          studentName={studentName}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function StudentHistoryCalendar({
  studentName,
  onClose,
}: {
  studentName: string;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const { loading, days, entriesFor } = useStudentHistoryByDay(studentName, true);
  const today = useToday();
  const digits = (value: string | number) => toLocaleDigits(String(value), locale);
  const localeTag = locale === "ar" ? "ar-EG" : "en-US";

  // Available days are matched by key, never by Date identity.
  const daySet = useMemo(() => new Set(days), [days]);

  // Default day: the newest day that has records, else today. `month` is local
  // state so the arrows travel; until the reader moves it, it follows the pick.
  const [picked, setPicked] = useState<string | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const todayIso = fromDateValue(today ?? new Date());
  const selectedIso = picked ?? days[0] ?? todayIso;
  const isToday = selectedIso === todayIso;
  const selectedDate = toDateValue(selectedIso);
  const activeMonth = month ?? monthStartOf(selectedDate);
  const monthTime = activeMonth.getTime();

  const entries = entriesFor(selectedIso);
  const morning = entries.find((entry) => entry.runType === "morning");
  const afternoon = entries.find((entry) => entry.runType === "afternoon");
  // The day's state is the pickup's; an afternoon-only day still has a record,
  // so it must not read as "unaccounted".
  const dayStatus = morning?.status ?? afternoon?.status ?? null;

  // School days = Mon–Fri, counted once for the calendar legend. Fixed across
  // locales on purpose: the same month must not change count with the language.
  const { have, total } = useMemo(() => {
    const date = new Date(monthTime);
    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    let weekdays = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const weekday = new Date(year, monthIndex, day).getDay();
      if (weekday !== 0 && weekday !== 6) weekdays += 1;
    }
    const prefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
    return {
      have: days.reduce(
        (count, iso) => (iso.startsWith(prefix) ? count + 1 : count),
        0,
      ),
      total: weekdays,
    };
  }, [days, monthTime]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, {
        month: "long",
        year: "numeric",
      }).format(new Date(monthTime)),
    [localeTag, monthTime],
  );

  return (
    <>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-outline-variant bg-surface px-4 py-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon
            name="history"
            size={18}
            variant="outlined"
            className="mt-0.5 flex-none text-on-surface-variant"
          />
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold text-on-surface">
              {studentName}
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-5 text-on-surface-variant">
              {t("history.daysWithRecords", {
                count: digits(have),
                month: monthLabel,
              })}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="md"
          icon
          className="flex-none"
          onClick={onClose}
          aria-label={t("dialog.close")}
        >
          <Icon name="close" size={22} />
        </Button>
      </header>

      {loading ? (
        <div
          className="px-4 pb-4 pt-1"
          role="status"
          aria-label={t("history.loading")}
        >
          <HistoryListSkeleton />
        </div>
      ) : days.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <Icon name="history" size={32} className="text-on-surface-variant" />
          <p className="text-[15px] text-on-surface-variant">
            {t("history.empty")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 px-4 pb-4 pt-2 min-[820px]:grid-cols-[360px_minmax(0,1fr)] min-[820px]:gap-5">
          {/* ── left: which day is available ─────────────────────────────── */}
          <div className="min-w-0">
            <Calendar
              value={selectedDate}
              onChange={(date) => setPicked(fromDateValue(date))}
              month={activeMonth}
              onMonthChange={setMonth}
              // Availability IS the encoding: no records ⇒ not selectable.
              disabledDates={(date) => !daySet.has(fromDateValue(date))}
              locale={localeTag}
              showToday
              labels={{
                today: t("dashboard.today"),
                previousMonth: t("history.previousMonth"),
                nextMonth: t("history.nextMonth"),
                todayWithDate: (formatted) =>
                  t("datePicker.todayWithDate", { date: formatted }),
              }}
            />

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
                {t("history.dayWithRecords")}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-outline-variant"
                  aria-hidden="true"
                />
                {t("history.noRecordsLegend")}
              </span>
              <span className="tabular-nums">
                {t("history.schoolDays", {
                  have: digits(have),
                  total: digits(total),
                })}
              </span>
            </div>
          </div>

          {/* ── right: the day the calendar points at ────────────────────── */}
          <section className="flex min-w-0 flex-col gap-3 min-[820px]:pt-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <h3 className="min-w-0 text-[14px] font-semibold text-on-surface">
                {formatDate(selectedIso, locale)}
              </h3>
              {/* Same pale-tint + dot chip as `AttendanceTable`. */}
              <span
                className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-[11.5px] font-medium ${DASH_STATUS_META[dayStatus ?? "WAITING"]}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[dayStatus ?? "WAITING"]}`}
                  aria-hidden="true"
                />
                {dayStatus
                  ? t(statusKey(dayStatus))
                  : t("busDetail.unaccounted")}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {entries.map((entry, index) => (
                <RunRow
                  key={`${selectedIso}-${entry.runType}-${index}`}
                  runType={entry.runType}
                  entry={entry}
                />
              ))}
              {/* A recorded morning with no afternoon is the day still open,
                  not a day without records: show the run as not started. */}
              {entries.length > 0 && !afternoon && (
                <RunRow runType="afternoon" />
              )}
            </div>

            {entries.length > 0 && (
              <p className="text-[12.5px] text-on-surface-variant">
                {t("history.recordedByDriver")}
              </p>
            )}
            {/* Only today can have an afternoon that has not started. A past
                day missing its drop-off is an incomplete record, and saying the
                run "has not begun" about last month would be a lie. */}
            {entries.length > 0 && !afternoon && isToday && (
              <p className="text-[12.5px] text-on-surface-variant">
                {t("history.dayOpen")}
              </p>
            )}
          </section>
        </div>
      )}

      <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant bg-surface px-4 py-3">
        {/* No CSV export: `buildAttendanceCsv` takes an `AttendanceRow`, which
            needs `grade`, `busId`, `boardOrder` and `dropOrder`, and the by-day
            history contract carries none of them. Inventing them (a null
            `boardOrder` on a row that *was* boarded) would put false data in a
            client's spreadsheet, so the footer ships the close action only. */}
        <Button type="button" variant="primary" size="md" onClick={onClose}>
          {t("tabs.done")}
        </Button>
      </footer>
    </>
  );
}

/**
 * One bordered row per run. `entry` absent means the run has no record yet: the
 * row steps down and reads "—" instead of inventing a time.
 */
function RunRow({
  runType,
  entry,
}: {
  runType: HistoryDayEntry["runType"];
  entry?: HistoryDayEntry;
}) {
  const { t, locale } = useLocale();
  const time = entry ? entryTime(entry) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5 rounded-xl border border-outline-variant px-3.5 py-3">
      <div className="min-w-0">
        <p
          className={`text-[13.5px] leading-5 ${
            entry
              ? "font-medium text-on-surface"
              : "font-normal text-on-surface-variant"
          }`}
        >
          {t(
            runType === "morning"
              ? "runType.morningPickup"
              : "runType.afternoonDropoff",
          )}
        </p>
        {entry && entry.busName !== "" && (
          <p className="mt-0.5 truncate text-[11.5px] tabular-nums text-on-surface-variant">
            {translateDataLabel(entry.busName, locale, t)}
          </p>
        )}
      </div>
      <div className="min-w-0 text-end">
        {time ? (
          <p className="flex items-center justify-end gap-1.5 whitespace-nowrap text-[13px] tabular-nums text-on-surface">
            <Icon name="check_circle" size={15} className="text-success" />
            {t(runType === "morning" ? "status.boarded" : "status.droppedOff")}{" "}
            {toLocaleDigits(time, locale)}
          </p>
        ) : (
          <p className="text-[13px] tabular-nums text-on-surface-variant">—</p>
        )}
        {!time && (
          <p className="mt-0.5 text-[11.5px] text-on-surface-variant">
            {t("history.notStarted")}
          </p>
        )}
      </div>
    </div>
  );
}
