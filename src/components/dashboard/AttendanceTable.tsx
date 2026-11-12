import type { AttendanceRow, RollSummary } from "@/data/dashboard";
import { DASH_STATUS_META, STATUS_DOT } from "@/data/dashboard";
import type { StudentStatus } from "@/data/students";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/arc/button/button";
import { staggerStyle } from "@/lib/motion";
import { useLocale } from "@/lib/i18n/context";
import {
  formatDayMonth,
  formatPercent,
  statusKey,
  toLocaleDigits,
  translateDataLabel,
} from "@/lib/i18n/format";
import { ROLL_SUMMARY_DAYS } from "@/lib/school-data";

interface AttendanceTableProps {
  rows: readonly AttendanceRow[];
  /** Presence per student id over the retention window (see RollSummary in @/data/dashboard). */
  summaries: ReadonlyMap<string, RollSummary>;
  /**
   * The caller is narrowing the roll (search / class), so an empty table means
   * "nothing matched", not "the school has no students".
   */
  hasFilters?: boolean;
  /** Open a student's attendance history (row History action). */
  onViewHistory?: (name: string) => void;
  /**
   * Correct the student's name or grade (row Edit action). Absent on a screen
   * that only reads the roster — this table maintains the school's records, so
   * the row has an action.
   */
  onEdit?: (row: AttendanceRow) => void;
}

/** A pale status chip with the same hue's dot. No solid fills in the roster. */
function StatusBadge({ status }: { status: StudentStatus }) {
  const { t } = useLocale();
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-[11.5px] font-medium ${DASH_STATUS_META[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
      {t(statusKey(status))}
    </span>
  );
}

/**
 * The roll's last recorded state. `rollRow` fills a student with no summary in
 * as `WAITING` — the absence of a record, not a state — so a missing map entry
 * must read as "no records" instead of surfacing its placeholder chip.
 */
function rollLastStatus(
  summary: RollSummary | undefined,
  fallback: StudentStatus,
): StudentStatus | null {
  if (summary) return summary.lastStatus;
  return fallback === "WAITING" ? null : fallback;
}

/**
 * The school roll: one row per child, summarising the whole retention window
 * (present days, absent days, attendance, last recorded day), because a single
 * day's timestamps would be an arbitrary slice of it.
 *
 * A real table at md+, and a two-line list of the same rows below it — never a
 * sideways-scrolling page on a phone.
 *
 * The phone rows are read-only apart from Edit / History, so they carry no
 * hover fill. The desktop table is striped (`table-zebra`): the stripe replaces
 * the row rule, because a stripe and a rule are two encodings of the same thing
 * and together they read as a grid.
 */
export function AttendanceTable({
  rows,
  summaries,
  hasFilters = false,
  onViewHistory,
  onEdit,
}: AttendanceTableProps) {
  const { t, locale } = useLocale();
  const digits = (value: string | number) => toLocaleDigits(String(value), locale);
  const days = digits(ROLL_SUMMARY_DAYS);

  // An empty roll has two causes, and they need different words: a school with
  // no students yet, or a filter that matched nobody. Claiming the roll is
  // empty while a search is active sends the director looking for the importer.
  const empty = (
    <div className="flex w-full flex-col items-center gap-1.5 px-4 py-12 text-center">
      <Icon
        name={hasFilters ? "search_off" : "groups"}
        size={24}
        variant="outlined"
        className="text-dash-outline"
      />
      <p className="text-[13.5px] font-medium text-dash-on-surface">
        {t(hasFilters ? "students.noMatchTitle" : "students.emptyRollTitle")}
      </p>
      <p className="text-[12.5px] text-dash-on-surface-variant">
        {t(hasFilters ? "students.noMatchSubtitle" : "students.emptyRollSubtitle")}
      </p>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
      {/* Phone: identity first, then the window's tally. */}
      <div className="md:hidden">
        {rows.length === 0
          ? empty
          : rows.map((row, index) => {
              const summary = summaries.get(row.id);
              const present = summary?.present ?? 0;
              const absent = summary?.absent ?? 0;
              const lastDate = summary?.lastDate ?? null;
              // The roll's map may not have a row yet (a student just added to
              // the snapshot); the row's own status is still the last recorded
              // one, except for the roll's "nothing recorded" placeholder.
              const status = rollLastStatus(summary, row.status);
              const recorded = present + absent;
              const percent = recorded === 0 ? 0 : Math.round((present / recorded) * 100);

              return (
                <div
                  key={row.id}
                  style={staggerStyle(index, rows.length)}
                  className="stagger-in border-b border-dash-outline-variant px-4 py-3.5 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Two lines, never a hidden identity: a long name gets the
                          full width instead of an ellipsis. */}
                      <p className="line-clamp-2 text-[14px] leading-5 font-medium break-words text-dash-on-surface">
                        {row.name}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-dash-on-surface-variant">
                        {translateDataLabel(row.grade, locale, t)} · {digits(row.bus)}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-1">
                      {status && <StatusBadge status={status} />}
                      {onEdit && (
                        <Button
                          type="button"
                          onClick={() => onEdit(row)}
                          aria-label={t("students.edit.aria", { name: row.name })}
                          variant="ghost"
                          size="md"
                          icon
                          className="flex-none"
                        >
                          <Icon name="edit" size={18} variant="outlined" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() => onViewHistory?.(row.name)}
                        aria-label={t("dashboard.historyAria", { name: row.name })}
                        variant="ghost"
                        size="md"
                        icon
                        className="flex-none"
                      >
                        <Icon name="history" size={18} variant="outlined" />
                      </Button>
                    </div>
                  </div>
                  {/* The tally is the line, so it wraps rather than truncates:
                      a cut-off "Last record" would drop the newest fact. A child
                      with nothing recorded gets the one honest phrase instead of
                      "Present 0 · Absent 0 · 0%". */}
                  <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[11.5px] text-dash-on-surface-variant">
                    {recorded === 0 ? (
                      <span>{t("students.noRecord")}</span>
                    ) : (
                      <>
                        <span>
                          {t("students.phonePresence", {
                            present: digits(present),
                            absent: digits(absent),
                            percent: digits(percent),
                          })}
                        </span>
                        {lastDate && (
                          <span className="text-dash-on-surface-variant">
                            {t("students.phoneLastRecord", {
                              date: formatDayMonth(lastDate, locale),
                            })}
                          </span>
                        )}
                      </>
                    )}
                  </p>
                </div>
              );
            })}
      </div>

      {/* Desktop: the striped table — the stripe replaces the row rule. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table-zebra w-full min-w-[720px] border-collapse text-start">
          <caption className="sr-only">
            {t("students.rollCaption", { days })}
          </caption>
          <thead>
            <tr className="border-b border-dash-outline-variant">
              <th
                scope="col"
                className="h-10 px-4 text-[11.5px] font-normal text-dash-on-surface-variant"
              >
                {t("dashboard.th.studentName")}
              </th>
              <th
                scope="col"
                className="h-10 px-4 text-[11.5px] font-normal text-dash-on-surface-variant"
              >
                {t("dashboard.th.grade")}
              </th>
              <th
                scope="col"
                className="h-10 px-4 text-[11.5px] font-normal text-dash-on-surface-variant"
              >
                {t("dashboard.th.bus")}
              </th>
              <th
                scope="col"
                title={t("students.presentTitle", { days })}
                className="h-10 px-4 text-end text-[11.5px] font-normal text-dash-on-surface-variant"
              >
                {t("students.th.present")}
              </th>
              <th
                scope="col"
                title={t("students.absentTitle", { days })}
                className="h-10 px-4 text-end text-[11.5px] font-normal text-dash-on-surface-variant"
              >
                {t("students.th.absent")}
              </th>
              <th
                scope="col"
                title={t("students.attendanceTitle")}
                className="h-10 px-4 text-end text-[11.5px] font-normal text-dash-on-surface-variant"
              >
                {t("students.th.attendance")}
              </th>
              <th
                scope="col"
                className="h-10 px-4 text-[11.5px] font-normal text-dash-on-surface-variant"
              >
                {t("students.th.lastRecord")}
              </th>
              <th
                scope="col"
                className="h-10 px-4 text-end text-[11.5px] font-normal text-dash-on-surface-variant"
              >
                {t("dashboard.th.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8}>{empty}</td>
              </tr>
            ) : (
              rows.map((row) => {
                const summary = summaries.get(row.id);
                const present = summary?.present ?? 0;
                const absent = summary?.absent ?? 0;
                const lastDate = summary?.lastDate ?? null;
                const lastStatus = rollLastStatus(summary, row.status);
                const recorded = present + absent;
                const percent = recorded === 0 ? 0 : Math.round((present / recorded) * 100);
                const badge = lastStatus ? <StatusBadge status={lastStatus} /> : null;

                return (
                  <tr key={row.id}>
                    <th scope="row" className="h-11 px-4 text-[13.5px] font-medium text-dash-on-surface">
                      {row.name}
                    </th>
                    <td className="px-4 text-[13px] text-dash-on-surface-variant">
                      {translateDataLabel(row.grade, locale, t)}
                    </td>
                    <td className="px-4 text-[13px] tabular-nums text-dash-on-surface-variant">
                      {digits(row.bus)}
                    </td>
                    <td className="px-4 text-end text-[13px] tabular-nums text-dash-on-surface">
                      {digits(present)}
                    </td>
                    {/* An absence is the one figure that should catch the eye;
                        zero stays quiet so a good term is not a wall of red. */}
                    <td
                      className={`px-4 text-end text-[13px] tabular-nums ${
                        absent > 0 ? "text-dash-error" : "text-dash-on-surface-variant"
                      }`}
                    >
                      {digits(absent)}
                    </td>
                    <td
                      className={`px-4 text-end text-[13px] tabular-nums ${
                        recorded === 0
                          ? "text-dash-on-surface-variant"
                          : "font-medium text-dash-on-surface"
                      }`}
                    >
                      {recorded === 0 ? "—" : formatPercent(percent, locale)}
                    </td>
                    <td className="px-4">
                      {lastDate ? (
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <span className="text-[13px] tabular-nums text-dash-on-surface-variant">
                            {formatDayMonth(lastDate, locale)}
                          </span>
                          {badge}
                        </span>
                      ) : badge ? (
                        // A status with no known day (the summary map has no
                        // entry yet) still beats claiming there are no records.
                        badge
                      ) : (
                        <span className="text-[13px] text-dash-on-surface-variant">
                          {t("students.noRecord")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 text-end">
                      <div className="flex items-center justify-end gap-1">
                        {onEdit && (
                          <Button
                            type="button"
                            onClick={() => onEdit(row)}
                            aria-label={t("students.edit.aria", { name: row.name })}
                            variant="ghost"
                            size="sm"
                            icon
                          >
                            <Icon name="edit" size={16} variant="outlined" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          onClick={() => onViewHistory?.(row.name)}
                          aria-label={t("dashboard.historyAria", { name: row.name })}
                          variant="ghost"
                          size="sm"
                        >
                          <Icon name="history" size={16} variant="outlined" />
                          {t("dashboard.th.actions")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
