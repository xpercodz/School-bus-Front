import { useMemo, useState } from "react";
import type { AttendanceRow, Bus } from "@/data/dashboard";
import { STATUS_DOT } from "@/data/dashboard";
import type { StudentStatus } from "@/data/students";
import type { MessageKey } from "@/lib/i18n/types";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/arc/button/button";
import { ExpandingSearch } from "@/components/arc/expanding-search/expanding-search";
import { RouteLine } from "@/components/dashboard/RouteLine";
import { StatusPill } from "@/components/dashboard/FleetList";
import { staggerStyle } from "@/lib/motion";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

interface BusOverviewModalProps {
  /** Bus to show; null closes the modal. */
  bus: Bus | null;
  /** That bus's rows for the run segment the dashboard is showing. */
  rows: readonly AttendanceRow[];
  onClose: () => void;
}

/**
 * The fleet row, opened: one bus's run and the students it carries, grouped by
 * what happened to them (on board, dropped off, still waiting, absent) so the
 * director can answer "who is off the bus and who is not" without leaving the
 * dashboard.
 *
 * The rows arrive already loaded from `useDashboardData`, so there is no query
 * or loading state here — opening is instant. Counts and progress are read from
 * the same `Bus` the row renders, and the student groups are the same
 * attendance rows the roster table shows, so the row, this modal and the table
 * cannot disagree.
 *
 * A phone gets the Dialog's bottom sheet; from sm up it is the wide centered
 * dialog. Both scroll inside the panel with the bus's identity and progress
 * pinned to the top.
 */
export function BusOverviewModal({ bus, rows, onClose }: BusOverviewModalProps) {
  const { t, locale } = useLocale();

  return (
    <Dialog
      open={bus !== null}
      onClose={onClose}
      title={
        bus
          ? t("fleet.title", { bus: translateDataLabel(bus.name, locale, t) })
          : t("fleet.titleNoBus")
      }
      // Closing clears the bus, which unmounts the body; an exit beat would
      // animate an empty panel out.
      exitAnimation={false}
      panelClassName="w-full max-w-2xl max-h-[88dvh] rounded-t-2xl bg-dash-surface pb-[env(safe-area-inset-bottom)] sm:max-h-[85dvh] sm:rounded-xl sm:pb-0"
    >
      {bus && <BusOverviewBody bus={bus} rows={rows} onClose={onClose} />}
    </Dialog>
  );
}

const GROUPS: readonly { status: StudentStatus; labelKey: MessageKey }[] = [
  { status: "BOARDED", labelKey: "fleet.sectionOnboard" },
  { status: "DROPPED_OFF", labelKey: "fleet.sectionDropped" },
  { status: "WAITING", labelKey: "fleet.sectionWaiting" },
  { status: "ABSENT", labelKey: "fleet.sectionAbsent" },
];

/** A missing timestamp is a dash, never a dimmed placeholder string. */
function timeText(value: string): string {
  return value.startsWith("--") ? "—" : value;
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
  const { t, locale } = useLocale();
  const digits = (n: number) => toLocaleDigits(String(n), locale);
  const busName = translateDataLabel(bus.name, locale, t);
  const unaccounted = bus.waiting + rows.filter((row) => row.status === "ABSENT").length;
  // The modal owns its own filter: it narrows the bus's already-loaded rows and
  // folds away to an icon when empty, like every other search in the app.
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase();
  const visibleRows = useMemo(
    () => (search ? rows.filter((row) => row.name.toLocaleLowerCase().includes(search)) : rows),
    [rows, search],
  );

  // Groups follow the row's own count order (on board, dropped, waiting), with
  // absent last — the row the director pressed expands in place. Empty groups
  // are left out rather than drawn as a heading with nothing under it.
  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        members: visibleRows
          .filter((row) => row.status === group.status)
          .sort((a, b) => a.name.localeCompare(b.name)),
      })).filter((group) => group.members.length > 0),
    [visibleRows],
  );

  const studentMeta = (row: AttendanceRow): string => {
    const grade = translateDataLabel(row.grade, locale, t);
    const detail =
      row.status === "BOARDED"
        ? `${t("dashboard.th.morningBoarded")} ${timeText(row.morningBoarded)}`
        : row.status === "DROPPED_OFF"
          ? `${t("dashboard.th.dropOffTime")} ${timeText(row.dropOffTime)}`
          : row.status === "WAITING"
            ? t("fleet.waitingHint")
            : t("fleet.absentHint");
    return `${grade} · ${detail}`;
  };

  return (
    <>
      {/* Solid, sticky header (no glass): identity, run state and the same
          progress the row shows, so the modal reads as that row expanded. */}
      <header className="sticky top-0 z-10 border-b border-dash-outline-variant bg-dash-surface-container-low px-4 py-3 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-semibold leading-6 text-dash-on-surface sm:text-dash-headline-lg">
              {busName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-[12.5px] leading-4 text-dash-on-surface-variant">
                {bus.driver ? t("dashboard.driver", { name: bus.driver }) : t("dashboard.noDriver")}
              </p>
              <StatusPill bus={bus} />
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
            <Icon name="close" size={20} variant="outlined" />
          </Button>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 text-[11.5px] text-dash-on-surface-variant">
            <span>{t("dashboard.routeProgress")}</span>
            <span className="tabular-nums">
              {t("dashboard.routeComplete", { percent: digits(bus.progress) })}
            </span>
          </div>
          <RouteLine
            progress={bus.progress}
            completed={bus.status === "COMPLETED"}
            live={bus.status === "IN_PROGRESS"}
          />
        </div>

        {rows.length > 0 && (
          <div
            className="mt-3 w-full sm:max-w-80"
            onKeyDown={(event) => {
              // The search folds back on Escape; without this the same press
              // also reaches the Dialog's document listener and closes the
              // whole overview. (The vendored picker stops propagation for the
              // same reason.) Stop only from the field, so Escape on the
              // collapsed search icon still closes the modal.
              if (event.key === "Escape" && event.target instanceof HTMLInputElement) {
                event.stopPropagation();
              }
            }}
          >
            <ExpandingSearch
              anchor="start"
              label={t("fleet.searchAria")}
              placeholder={t("fleet.searchPlaceholder")}
              clearLabel={t("mobile.clearSearchAria")}
              value={query}
              onValueChange={setQuery}
            />
          </div>
        )}
      </header>

      <div className="flex flex-col gap-5 px-4 py-4 sm:px-6 sm:py-5">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Icon
              name="directions_bus"
              size={36}
              variant="outlined"
              className="text-dash-on-surface-variant"
            />
            <p className="text-[15px] font-medium text-dash-on-surface">
              {t("fleet.emptyTitle")}
            </p>
            <p className="text-[12.5px] text-dash-on-surface-variant">{t("fleet.emptyBody")}</p>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Icon
              name="search_off"
              size={32}
              variant="outlined"
              className="text-dash-on-surface-variant"
            />
            <p className="text-[15px] font-medium text-dash-on-surface">
              {t("fleet.searchEmptyTitle")}
            </p>
            <p className="text-[12.5px] text-dash-on-surface-variant">
              {t("fleet.searchEmptyBody")}
            </p>
          </div>
        ) : (
          <>
            <p className="text-[13px] leading-5 text-dash-on-surface-variant">
              {search
                ? t("fleet.searchMatches", {
                    shown: digits(visibleRows.length),
                    total: digits(rows.length),
                  })
                : unaccounted === 0
                  ? t("dashboard.finding.allClear", { total: digits(rows.length) })
                  : t("dashboard.finding.open", {
                      count: digits(unaccounted),
                      total: digits(rows.length),
                    })}
            </p>

            {groups.map((group) => {
              const sectionId = `fleet-overview-${group.status}`;
              return (
                <section key={group.status} aria-labelledby={sectionId} className="flex flex-col gap-2">
                  <div className="flex items-end justify-between gap-3">
                    <h3
                      id={sectionId}
                      className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-dash-on-surface"
                    >
                      <span
                        className={`h-2 w-2 flex-none rounded-full ${STATUS_DOT[group.status]}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{t(group.labelKey)}</span>
                    </h3>
                    <span className="flex-none text-[12px] tabular-nums text-dash-on-surface-variant">
                      {digits(group.members.length)}
                    </span>
                  </div>

                  <ul className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
                    {group.members.map((row, index) => (
                      <li
                        key={row.id}
                        className="stagger-in border-b border-dash-outline-variant px-3.5 py-2.5 last:border-b-0"
                        style={staggerStyle(index, group.members.length)}
                      >
                        <p className="truncate text-[13.5px] font-medium leading-5 text-dash-on-surface">
                          {row.name}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] leading-4 text-dash-on-surface-variant">
                          {studentMeta(row)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
