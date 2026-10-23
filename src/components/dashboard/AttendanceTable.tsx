import type { AttendanceRow } from "@/data/dashboard";
import { DASH_STATUS_META, STATUS_DOT } from "@/data/dashboard";
import type { StudentStatus } from "@/data/students";
import { Icon } from "@/components/Icon";
import { staggerStyle } from "@/lib/motion";
import { useLocale } from "@/lib/i18n/context";
import { statusKey, toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

interface AttendanceTableProps {
  rows: readonly AttendanceRow[];
  /** Open a student's attendance history (row History action). */
  onViewHistory?: (name: string) => void;
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

/** A missing timestamp is a dash, never a dimmed placeholder string. */
function timeText(value: string): string {
  return value.startsWith("--") ? "—" : value;
}

/**
 * Live student attendance. A real table at md+, and a two-line list of the same
 * rows below it — never a sideways-scrolling page on a phone.
 *
 * The phone rows are read-only (the only control is the 44px History button),
 * so they carry no hover fill; the desktop rules are unchanged.
 */
export function AttendanceTable({ rows, onViewHistory }: AttendanceTableProps) {
  const { t, locale } = useLocale();
  const digits = (n: string) => toLocaleDigits(n, locale);

  const empty = (
    <div className="flex w-full flex-col items-center gap-1.5 px-4 py-12 text-center">
      <Icon name="search_off" size={24} variant="outlined" className="text-dash-outline" />
      <p className="text-[13.5px] font-medium text-dash-on-surface">{t("dashboard.emptyTitle")}</p>
      <p className="text-[12.5px] text-dash-on-surface-variant">{t("dashboard.emptySubtitle")}</p>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
      {/* Phone: identity first, then the two timestamps. */}
      <div className="md:hidden">
        {rows.length === 0 ? (
          empty
        ) : (
          rows.map((row, index) => (
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
                  <StatusBadge status={row.status} />
                  <button
                    type="button"
                    onClick={() => onViewHistory?.(row.name)}
                    aria-label={t("dashboard.historyAria", { name: row.name })}
                    className="press flex h-11 w-11 flex-none items-center justify-center rounded-md text-dash-on-surface-variant md:hover:bg-dash-surface-container-low"
                  >
                    <Icon name="history" size={18} variant="outlined" />
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-[11.5px] text-dash-on-surface-variant">
                {t("dashboard.th.morningBoarded")} {timeText(row.morningBoarded)} ·{" "}
                {t("dashboard.th.dropOffTime")} {timeText(row.dropOffTime)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Desktop: rules and alignment, no fill band and no zebra. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse text-start">
          <caption className="sr-only">{t("dashboard.caption")}</caption>
          <thead>
            <tr className="border-b border-dash-outline-variant">
              <th scope="col" className="h-10 px-4 text-[11.5px] font-normal text-dash-on-surface-variant">
                {t("dashboard.th.studentName")}
              </th>
              <th scope="col" className="h-10 px-4 text-[11.5px] font-normal text-dash-on-surface-variant">
                {t("dashboard.th.grade")}
              </th>
              <th scope="col" className="h-10 px-4 text-[11.5px] font-normal text-dash-on-surface-variant">
                {t("dashboard.th.bus")}
              </th>
              <th scope="col" className="h-10 px-4 text-[11.5px] font-normal text-dash-on-surface-variant">
                {t("dashboard.th.morningBoarded")}
              </th>
              <th scope="col" className="h-10 px-4 text-[11.5px] font-normal text-dash-on-surface-variant">
                {t("dashboard.th.dropOffTime")}
              </th>
              <th scope="col" className="h-10 px-4 text-[11.5px] font-normal text-dash-on-surface-variant">
                {t("dashboard.th.currentStatus")}
              </th>
              <th scope="col" className="h-10 px-4 text-end text-[11.5px] font-normal text-dash-on-surface-variant">
                {t("dashboard.th.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>{empty}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-dash-outline-variant last:border-b-0 hover:bg-dash-surface-container-low"
                >
                  <th scope="row" className="h-11 px-4 text-[13.5px] font-medium text-dash-on-surface">
                    {row.name}
                  </th>
                  <td className="px-4 text-[13px] text-dash-on-surface-variant">
                    {translateDataLabel(row.grade, locale, t)}
                  </td>
                  <td className="px-4 text-[13px] tabular-nums text-dash-on-surface-variant">
                    {digits(row.bus)}
                  </td>
                  <td className="px-4 text-[13px] tabular-nums text-dash-on-surface">
                    {timeText(row.morningBoarded)}
                  </td>
                  <td className="px-4 text-[13px] tabular-nums text-dash-on-surface">
                    {timeText(row.dropOffTime)}
                  </td>
                  <td className="px-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 text-end">
                    <button
                      type="button"
                      onClick={() => onViewHistory?.(row.name)}
                      aria-label={t("dashboard.historyAria", { name: row.name })}
                      className="press inline-flex h-8 items-center gap-1.5 rounded px-2 text-[12.5px] text-dash-on-surface-variant hover:bg-dash-surface-container hover:text-dash-on-surface pointer-coarse:h-11 pointer-coarse:px-3"
                    >
                      <Icon name="history" size={16} variant="outlined" />
                      {t("dashboard.th.actions")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
