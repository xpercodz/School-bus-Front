import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { AttendanceRow, Bus } from "@/data/dashboard";
import { DASH_STATUS_META, STATUS_DOT } from "@/data/dashboard";
import type { StudentStatus } from "@/data/students";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/arc/button/button";
import { PaginationBar } from "@/components/dashboard/PaginationBar";
import { usePageSlice } from "@/lib/use-page-slice";
import { useLocale } from "@/lib/i18n/context";
import { statusKey, toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

const PAGE_SIZE = 10;

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** The two columns that stay put while a phone scrolls the sheet sideways. */
const STICKY_OFF =
  "max-md:sticky max-md:start-0 max-md:z-10 max-md:border-e max-md:border-dash-outline-variant";
const STICKY_NAME =
  "max-md:sticky max-md:start-[52px] max-md:z-10 max-md:border-e max-md:border-dash-outline-variant";

interface BusOverviewModalProps {
  /** Bus to show; null closes the modal. */
  bus: Bus | null;
  /** That bus's rows for the run segment the dashboard is showing. */
  rows: readonly AttendanceRow[];
  onClose: () => void;
}

/**
 * The fleet row, opened: one bus's sheet, listed the way the run actually
 * happened — the students who came off first, in order, numbered, then who is
 * still aboard, then anyone unaccounted for.
 *
 * The ordinal is this bus's own sequence, so it restarts at 1 for every bus
 * (the run-wide `dropOrder` is the roster's, not this dialog's). The rows
 * arrive already loaded from `useDashboardData`, so opening is instant and the
 * sheet re-derives from the same snapshot the row and the roster table read —
 * the three can never disagree.
 *
 * A phone gets the Dialog's bottom sheet with the table scrolling inside its
 * own frame (the first two columns stay readable); from sm up it is the wide
 * centered dialog with the same sheet.
 */
export function BusOverviewModal({ bus, rows, onClose }: BusOverviewModalProps) {
  const { t, locale } = useLocale();

  return (
    <Dialog
      open={bus !== null}
      onClose={onClose}
      title={bus ? translateDataLabel(bus.name, locale, t) : t("fleet.titleNoBus")}
      // Closing clears the bus, which unmounts the body; an exit beat would
      // animate an empty panel out.
      exitAnimation={false}
      panelClassName="w-full max-w-[880px] max-h-[88dvh] rounded-t-2xl bg-dash-surface pb-[env(safe-area-inset-bottom)] sm:max-h-[85dvh] sm:rounded-xl sm:pb-0"
    >
      {bus && <BusOverviewBody bus={bus} rows={rows} onClose={onClose} />}
    </Dialog>
  );
}

/** A pale status chip with the same hue's dot. No solid fills in the roster. */
function StatusChip({ status }: { status: StudentStatus }) {
  const { t } = useLocale();
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-[11.5px] font-medium ${DASH_STATUS_META[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
      {/* "No record yet" is not a status: it reads as unaccounted, never "Waiting". */}
      {status === "WAITING" ? t("busDetail.unaccounted") : t(statusKey(status))}
    </span>
  );
}

/** A missing timestamp is a dash, never a dimmed placeholder string. */
function timeText(value: string | null | undefined): string {
  return !value || value.startsWith("--") ? "—" : value;
}

/**
 * Minutes since midnight for a localized clock string, so a run is ordered by
 * its clock and not by its text: a 12-hour string sorts wrongly across noon
 * ("12:30 PM" before "01:10 PM") and Eastern Arabic digits carry a meridiem
 * suffix. A missing time sorts last within its group.
 */
function timeValue(value: string | null | undefined): number {
  if (!value || value.startsWith("--")) return Number.POSITIVE_INFINITY;
  const ascii = value.replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
  const match = /(\d{1,2}):(\d{2})/.exec(ascii);
  if (!match) return Number.POSITIVE_INFINITY;
  const minute = Number(match[2]);
  let hour = Number(match[1]);
  if (/p/i.test(ascii) || ascii.includes("م")) hour = (hour % 12) + 12;
  else if (/a/i.test(ascii) || ascii.includes("ص")) hour %= 12;
  return hour * 60 + minute;
}

interface SheetRow {
  row: AttendanceRow;
  /** 1-based place in this bus's drop-off sequence; null when not dropped off. */
  off: number | null;
}

/**
 * Dropped first (by drop time, numbered 1..n), then onboarded (by board time),
 * then everyone else by name. The number is re-derived here per bus on
 * purpose: it is the dialog's sequence, not the run's.
 */
function orderSheetRows(rows: readonly AttendanceRow[]): SheetRow[] {
  const byName = (a: AttendanceRow, b: AttendanceRow) => a.name.localeCompare(b.name);
  const dropped = rows
    .filter((row) => row.status === "DROPPED_OFF")
    .sort((a, b) => timeValue(a.dropOffTime) - timeValue(b.dropOffTime) || byName(a, b));
  const boarded = rows
    .filter((row) => row.status === "BOARDED")
    .sort((a, b) => timeValue(a.morningBoarded) - timeValue(b.morningBoarded) || byName(a, b));
  const rest = rows
    .filter((row) => row.status !== "DROPPED_OFF" && row.status !== "BOARDED")
    .sort(byName);

  return [
    ...dropped.map((row, index) => ({ row, off: index + 1 })),
    ...boarded.map((row) => ({ row, off: null })),
    ...rest.map((row) => ({ row, off: null })),
  ];
}

function BusOverviewBody({
  bus,
  rows,
  onClose,
}: {
  bus: Bus;
  rows: readonly AttendanceRow[];
  onClose: () => void;
}) {
  const { t, tp, locale } = useLocale();
  const navigate = useNavigate();
  const digits = (value: number | string) => toLocaleDigits(String(value), locale);
  const busName = translateDataLabel(bus.name, locale, t);

  const sheet = useMemo(() => orderSheetRows(rows), [rows]);
  // The dialog opens on page 1; a different bus is a different list, so it
  // resets there rather than keeping a page number that no longer exists.
  const page = usePageSlice(sheet, PAGE_SIZE, bus.id);

  const absent = useMemo(
    () => rows.filter((row) => row.status === "ABSENT").length,
    [rows],
  );
  const offCount = useMemo(() => sheet.filter((item) => item.off !== null).length, [sheet]);
  const firstOff = sheet.find((item) => item.off !== null)?.row.dropOffTime ?? null;
  const empty = rows.length === 0;

  const openInStudents = () => {
    navigate("/dashboard/students");
    onClose();
  };

  return (
    /* The Dialog's scroll box wraps one child; this column then keeps header
       and footer put while only the sheet between them scrolls. */
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Solid header (no glass): the bus's identity and its run, so the sheet
          reads as the fleet row expanded. */}
      <header className="flex flex-none items-start justify-between gap-3 border-b border-dash-outline-variant bg-dash-surface-container-low px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-[18px] font-semibold leading-6 text-dash-on-surface sm:text-dash-headline-lg">
            {busName}
          </h2>
          <p className="mt-1 truncate text-[12.5px] leading-4 text-dash-on-surface-variant">
            {tp("busDetail.hint", rows.length, {
              driver: bus.driver ? bus.driver : t("dashboard.noDriver"),
              count: digits(rows.length),
              percent: digits(bus.progress),
            })}
          </p>
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
          <Icon name="close" size={20} variant="outlined" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
        {/* Three figures, no tiles and no icons: label over value, one rule
            between them. `waiting` is deliberately absent — this screen lists
            who is on and off the bus. */}
        <dl className="flex-none grid grid-cols-3">
          <div className="min-w-0 pe-3 sm:pe-4">
            <dt className="text-[11.5px] leading-4 text-dash-on-surface-variant">
              {t("kpi.onboard.label")}
            </dt>
            <dd className="mt-[5px] text-[20px] font-semibold leading-[1.1] tabular-nums text-dash-on-surface">
              {digits(bus.onboard)}
            </dd>
          </div>
          <div className="min-w-0 border-s border-dash-outline-variant px-3 sm:px-4">
            <dt className="text-[11.5px] leading-4 text-dash-on-surface-variant">
              {t("kpi.dropped.label")}
            </dt>
            <dd className="mt-[5px] text-[20px] font-semibold leading-[1.1] tabular-nums text-dash-on-surface">
              {digits(bus.droppedOff)}
            </dd>
          </div>
          <div className="min-w-0 border-s border-dash-outline-variant ps-3 sm:ps-4">
            <dt className="text-[11.5px] leading-4 text-dash-on-surface-variant">
              {t("status.absent")}
            </dt>
            <dd className="mt-[5px] text-[20px] font-semibold leading-[1.1] tabular-nums text-dash-on-surface">
              {digits(absent)}
            </dd>
          </div>
        </dl>

        {empty ? (
          <p className="flex-none text-[13px] leading-5 text-dash-on-surface-variant">
            {t("reports.emptySubtitle")}
          </p>
        ) : (
          <>
            {/* The sheet keeps its desktop pitch and scrolls inside this
                frame; below md the ordinal and the name stay pinned so "who
                came off first" is never off screen. */}
            <div className="flex-none overflow-x-auto overscroll-x-contain">
              <table className="table-zebra w-full min-w-[640px] border-collapse text-start">
                <caption className="sr-only">
                  {t("busDetail.caption", { bus: busName })}
                </caption>
                <thead>
                  <tr className="border-b border-dash-outline-variant">
                    <th
                      scope="col"
                      className={`h-10 w-[52px] ps-4 text-[11.5px] font-normal text-dash-on-surface-variant max-md:bg-dash-surface ${STICKY_OFF}`}
                    >
                      {t("busDetail.offColumn")}
                    </th>
                    <th
                      scope="col"
                      className={`h-10 min-w-[160px] px-4 text-[11.5px] font-normal text-dash-on-surface-variant max-md:bg-dash-surface ${STICKY_NAME}`}
                    >
                      {t("dashboard.th.studentName")}
                    </th>
                    <th
                      scope="col"
                      className="h-10 w-[104px] whitespace-nowrap px-4 text-[11.5px] font-normal text-dash-on-surface-variant"
                    >
                      {t("dashboard.th.grade")}
                    </th>
                    <th
                      scope="col"
                      className="h-10 w-[120px] whitespace-nowrap px-4 text-[11.5px] font-normal text-dash-on-surface-variant"
                    >
                      {t("dashboard.th.morningBoarded")}
                    </th>
                    <th
                      scope="col"
                      className="h-10 w-[120px] whitespace-nowrap px-4 text-[11.5px] font-normal text-dash-on-surface-variant"
                    >
                      {t("dashboard.th.dropOffTime")}
                    </th>
                    <th
                      scope="col"
                      className="h-10 w-[120px] px-4 text-end text-[11.5px] font-normal text-dash-on-surface-variant"
                    >
                      {t("dashboard.th.currentStatus")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.paged.map(({ row, off }) => (
                    <tr
                      key={row.id}
                      className={`bg-dash-surface ${
                        // The last of the drop-off sequence closes the run:
                        // one rule in the stronger outline, so "the numbers
                        // stop here" is visible without a second mark.
                        off !== null && off === offCount
                          ? "border-b border-dash-outline"
                          : ""
                      }`}
                    >
                      <td
                        className={`h-11 w-[52px] ps-4 text-[13px] tabular-nums max-md:bg-inherit ${STICKY_OFF}`}
                      >
                        {off === null ? (
                          <span className="text-dash-on-surface-variant">—</span>
                        ) : (
                          <span className="text-dash-primary">{digits(off)}</span>
                        )}
                      </td>
                      <th
                        scope="row"
                        className={`h-11 min-w-[160px] px-4 text-[13.5px] font-medium text-dash-on-surface max-md:bg-inherit ${STICKY_NAME}`}
                      >
                        {row.name}
                      </th>
                      <td className="h-11 whitespace-nowrap px-4 text-[13px] text-dash-on-surface-variant">
                        {translateDataLabel(row.grade, locale, t)}
                      </td>
                      <td className="h-11 whitespace-nowrap px-4 text-[13px] tabular-nums text-dash-on-surface-variant">
                        {timeText(row.morningBoarded)}
                      </td>
                      <td className="h-11 whitespace-nowrap px-4 text-[13px] tabular-nums text-dash-on-surface">
                        {timeText(row.dropOffTime)}
                      </td>
                      <td className="h-11 px-4 text-end">
                        <StatusChip status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* One page of the same list; a bus that fits on one page has no
                pager at all. */}
            {page.totalPages > 1 && (
              <div className="flex-none border-t border-dash-outline-variant py-2.5">
                <PaginationBar pagination={page} />
              </div>
            )}
          </>
        )}
      </div>

      <footer className="flex flex-none flex-col gap-2 border-t border-dash-outline-variant bg-dash-surface-container-low px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-x-4 sm:px-6">
        <p className="min-w-0 text-[12.5px] text-dash-on-surface-variant">
          {t("busDetail.foot", {
            off: digits(bus.droppedOff),
            total: digits(rows.length),
            time: timeText(firstOff),
          })}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="arc-field"
            onClick={openInStudents}
          >
            {t("busDetail.openInStudents")}
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onClose}>
            {t("dialog.close")}
          </Button>
        </div>
      </footer>
    </div>
  );
}
