import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RunSegmentId } from "@/data/dashboard";
import { STUDENT_STATUS_FILTERS } from "@/data/dashboard";
import {
  ROLL_SUMMARY_DAYS,
  rollRow,
  todayDateStr,
  useDashboardData,
  useRollSummary,
  useSchoolRoll,
} from "@/lib/school-data";
import {
  useStudentList,
  type StudentListState,
  type StudentSort,
} from "@/lib/use-student-list";
import { usePageReveal } from "@/lib/use-page-reveal";
import { useSelectedDate } from "@/lib/selected-date";
import { buildAttendanceCsv, buildRollCsv, downloadCsv } from "@/lib/csv";
import { useSchoolName } from "@/lib/school";
import { AttendanceTable } from "@/components/dashboard/AttendanceTable";
import { DateSegmentBar } from "@/components/dashboard/DateSegmentBar";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PaginationBar } from "@/components/dashboard/PaginationBar";
import { Icon } from "@/components/Icon";
import { Skeleton, SkeletonText } from "@/components/Skeleton";
import { StudentHistorySheet } from "@/components/StudentHistorySheet";
import { EditStudentDialog, type EditableStudent } from "@/components/dashboard/EditStudentDialog";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/arc/button/button";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { ExpandingSearch } from "@/components/arc/expanding-search/expanding-search";
import { useLocale } from "@/lib/i18n/context";
import { statusKey, toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";

/** The three orders the day view offers, in the order the menu lists them. */
const SORT_IDS: readonly StudentSort[] = ["runOrder", "name", "grade"];

/**
 * The roll offers two: a child's place in a run is a fact about a day, so it
 * has no meaning on the all-students view.
 */
const ROLL_SORT_IDS: readonly StudentSort[] = ["name", "grade"];

const SORT_LABEL_KEY: Record<StudentSort, MessageKey> = {
  runOrder: "students.sort.runOrder",
  name: "students.sort.name",
  grade: "students.sort.grade",
};

/**
 * Students — the school roll. With no date picked it lists **every** student
 * with their presence over the retention window, so the screen always answers
 * "who is on the roll?"; picking a day on the calendar narrows it to that
 * day's runs, and each row's History opens the calendar of one child.
 *
 * The two views share one row shape (`AttendanceRow`), one filter/sort/page
 * hook and one table, so search, pagination and export never diverge between
 * them: `rollRow` fills the day-only fields with the app's own "no time"
 * placeholder, which the roll view never renders.
 */
export default function StudentsPage() {
  const { t, tp, locale } = useLocale();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const schoolName = useSchoolName();

  // This screen's own day — remembered for the tab, never shared with the
  // other day-scoped pages.
  const [date, setDate] = useSelectedDate("students");
  const [segment, setSegment] = useState<RunSegmentId>("morning");
  const [historyStudent, setHistoryStudent] = useState<string | null>(null);
  // Correcting a name or grade: the only student fields this screen writes. The
  // bus belongs to Assignments, where the grant and the audit entry live.
  const [editing, setEditing] = useState<EditableStudent | null>(null);

  // No date = the whole roll; a date = that day's run. Everything below keys
  // off this one choice, so the two states can never half-apply.
  const rollMode = date === null;

  // The roll is read in both modes: it is the header's count and the no-date
  // rows. The day query is skipped while the roll is on screen (and vice
  // versa), so the screen never pays for a read it is not showing.
  const roll = useSchoolRoll();
  const summary = useRollSummary(rollMode);
  const day = useDashboardData(date, segment, !rollMode);

  const effectiveDate = date ?? todayDateStr();

  // The roll is scoped to one run segment (every attendance row belongs to
  // one); the run order is the default because the drop-off place is a run
  // fact, not an alphabetical one.
  const dayRows = useMemo(
    () => day.attendance.filter((row) => row.runType === segment),
    [day.attendance, segment],
  );
  const rollRows = useMemo(
    () =>
      roll.students.map((student) =>
        rollRow(student, summary.byStudentId.get(student.id)),
      ),
    [roll.students, summary.byStudentId],
  );
  const rows = rollMode ? rollRows : dayRows;
  const list = useStudentList(rows, "runOrder");

  // The status filter is a day fact ("show me who is absent today"), so it is
  // hidden on the roll — and cleared when the view flips, or an invisible
  // filter would silently shorten the list.
  const [wasRollMode, setWasRollMode] = useState(rollMode);
  if (wasRollMode !== rollMode) {
    setWasRollMode(rollMode);
    list.setStatus("ALL");
  }

  // "Run order" has no run to order by on the roll: every row is unranked, so
  // the comparator falls through to name order. Label it as what it is instead
  // of offering a control that would change nothing.
  const sort: StudentSort =
    rollMode && list.sort === "runOrder" ? "name" : list.sort;

  const loading = rollMode
    ? roll.live && (roll.loading || summary.loading)
    : day.live && day.loading;
  const live = rollMode ? roll.live : day.live;

  // One coordinated reveal when the data blocks actually render; a live
  // snapshot update does not replay it (loading does not change).
  usePageReveal(!(live && loading));

  const digits = (value: string | number) =>
    toLocaleDigits(String(value), locale);

  const classes = useMemo(
    () => new Set(roll.students.map((student) => student.grade)).size,
    [roll.students],
  );

  const subtitle = t("students.subtitle", {
    school: schoolName ?? t("dashboard.loading"),
    count: digits(roll.students.length),
    classes: digits(classes),
  });

  function handleExport() {
    if (rollMode) {
      // The roll's columns are presence over the window, not a run: exporting
      // day-shaped rows here would write "--:--:--" times into a spreadsheet.
      downloadCsv(
        `students-roll-${effectiveDate}.csv`,
        buildRollCsv(list.filtered, summary.byStudentId, t, locale),
      );
    } else {
      downloadCsv(
        `students-${effectiveDate}.csv`,
        buildAttendanceCsv(list.filtered, t, locale),
      );
    }
    showToast(
      t("toast.exported", { count: digits(list.filtered.length) }),
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <PageHeader
          title={t("students.title")}
          subtitle={subtitle}
          actions={
            <>
              <Button
                type="button"
                onClick={handleExport}
                variant="secondary"
                size="md"
                className="arc-field"
              >
                <Icon name="download" size={16} variant="outlined" />
                {t("reports.export")}
              </Button>
              {/* Students are created on the Assignments screen (or by importing the
                  school's sheet), so the control takes the director there instead of
                  sitting disabled — a disabled button with a tooltip is a hint no
                  keyboard or screen-reader user can reach. */}
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => navigate("/dashboard/assignments")}
              >
                <Icon name="person_add" size={16} variant="outlined" />
                {t("students.add")}
              </Button>
            </>
          }
        />
      </div>

      {/* Scope row: sticks under the phone header and takes the top edge at lg,
          where the rail replaces that header — same classes as FilterBar. */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b border-dash-outline-variant bg-dash-background px-4 py-2.5 sm:px-6 lg:top-0">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-3">
          <div data-hint="date" className="flex flex-wrap items-center gap-3">
            <DateSegmentBar
              date={date}
              onDateChange={setDate}
              segment={segment}
              onSegmentChange={setSegment}
              // No date is the whole roll, not "today" — say so in the field and
              // in the clear action, which both lead back to it.
              placeholder={t("students.allStudents")}
              clearLabel={t("students.allStudents")}
              showSegment={!rollMode}
            />
          </div>
          <p className="ms-auto text-[11.5px] leading-4 text-dash-on-surface-variant">
            {t("students.retention")}
          </p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
        {!live && (
          <div
            role="status"
            className="flex items-center gap-2 text-[13px] text-dash-on-surface-variant"
          >
            <Icon name="info" size={16} variant="outlined" />
            {t("dashboard.liveUnavailable")}
          </div>
        )}

        <section
          data-page-reveal
          data-tour="students-roll"
          aria-labelledby="students-roll-title"
          className="flex flex-col gap-3"
        >
          <div className="flex items-end justify-between gap-4">
            <h2
              id="students-roll-title"
              className="text-[15px] font-semibold text-dash-on-surface"
            >
              {t("students.roll")}
            </h2>
            <p className="flex-none text-[12px] text-dash-on-surface-variant">
              {tp("students.meta", list.total, {
                count: digits(list.total),
                sort: t(SORT_LABEL_KEY[sort]),
              })}
              {rollMode &&
                ` · ${t("students.range", { days: digits(ROLL_SUMMARY_DAYS) })}`}
            </p>
          </div>

          <StudentsToolbar list={list} rollMode={rollMode} sort={sort} />

          {live && loading ? (
            <div role="status" aria-label={t("dashboard.loading")}>
              <RollSkeleton />
            </div>
          ) : (
            <>
              <div data-tour="students-history" className="flex flex-col gap-3">
                <AttendanceTable
                  rows={list.paged}
                  onViewHistory={setHistoryStudent}
                  onEdit={(row) =>
                    setEditing({
                      id: row.id,
                      name: row.name,
                      grade: row.grade,
                      busId: row.busId || null,
                    })
                  }
                  view={rollMode ? "roll" : "day"}
                  summaries={summary.byStudentId}
                  hasFilters={list.hasFilters}
                  showOrder={!rollMode}
                />
                <PaginationBar pagination={list} />
              </div>
            </>
          )}
        </section>
      </div>

      <StudentHistorySheet
        studentName={historyStudent}
        onClose={() => setHistoryStudent(null)}
      />

      <EditStudentDialog student={editing} onClose={() => setEditing(null)} />
    </>
  );
}

/**
 * Search, then the value selectors the current view is read by, then the clear
 * action. Every control is an Arc control with `arc-field` so the outlined
 * edge keeps its 3:1 step; the phone wraps them, the desktop keeps one row.
 */
function StudentsToolbar({
  list,
  rollMode,
  sort,
}: {
  list: StudentListState;
  rollMode: boolean;
  sort: StudentSort;
}) {
  const { t, locale } = useLocale();

  const statusOptions = STUDENT_STATUS_FILTERS.map((status) => ({
    label: status === "ALL" ? t("tabs.all") : t(statusKey(status)),
    checked: list.status === status,
    onSelect: () => list.setStatus(status),
  }));

  return (
    <div
      data-tour="students-toolbar"
      className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center"
    >
      <div className="group/search min-w-0 md:w-56 md:flex-none">
        <ExpandingSearch
          anchor="start"
          label={t("studentList.searchAria")}
          placeholder={t("studentList.searchPlaceholder")}
          clearLabel={t("mobile.clearSearchAria")}
          value={list.query}
          onValueChange={list.setQuery}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu
          ariaLabel={t("students.sortAria")}
          label={t(SORT_LABEL_KEY[sort])}
          align="start"
          triggerClassName="arc-field"
          items={(rollMode ? ROLL_SORT_IDS : SORT_IDS).map((id) => ({
            label: t(SORT_LABEL_KEY[id]),
            checked: sort === id,
            onSelect: () => list.setSort(id),
          }))}
        />

        {!rollMode && (
          <DropdownMenu
            ariaLabel={t("studentList.statusAria")}
            label={
              list.status === "ALL" ? t("tabs.all") : t(statusKey(list.status))
            }
            align="start"
            triggerClassName="arc-field"
            items={statusOptions}
          />
        )}

        <DropdownMenu
          ariaLabel={t("studentList.gradeAria")}
          label={
            list.grade
              ? translateDataLabel(list.grade, locale, t)
              : t("studentList.allGrades")
          }
          align="start"
          triggerClassName="arc-field"
          // From four grades up the list is scannable rather than read top to
          // bottom, and the field is one row. The leading "All grades" row is a
          // filter reset, not an option, so it is not counted.
          searchable={
            list.grades.length >= 4
              ? {
                  placeholder: t("dropdown.searchPlaceholder"),
                  emptyLabel: t("dropdown.searchEmpty"),
                }
              : undefined
          }
          items={[
            {
              label: t("studentList.allGrades"),
              checked: !list.grade,
              onSelect: () => list.setGrade(null),
            },
            ...list.grades.map((grade) => ({
              label: translateDataLabel(grade, locale, t),
              checked: list.grade === grade,
              onSelect: () => list.setGrade(grade),
            })),
          ]}
        />

        {list.hasFilters && (
          <Button
            type="button"
            onClick={list.clearFilters}
            variant="secondary"
            size="md"
            className="arc-field"
          >
            <Icon name="filter_alt_off" size={16} variant="outlined" />
            {t("studentList.clear")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Mirrors the roll's rows while the snapshot is in flight, so nothing shifts. */
function RollSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-dash-outline-variant px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-3 w-6 flex-none" />
          <SkeletonText className="w-40 flex-none" />
          <SkeletonText className="w-16 flex-none" />
          <SkeletonText className="w-12 flex-none" />
          <SkeletonText className="ms-auto w-20 flex-none" />
        </div>
      ))}
    </div>
  );
}
