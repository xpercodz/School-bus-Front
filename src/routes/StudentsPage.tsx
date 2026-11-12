import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  rollRow,
  todayDateStr,
  useRollSummary,
  useSchoolRoll,
} from "@/lib/school-data";
import {
  useStudentList,
  type StudentListState,
  type StudentSort,
} from "@/lib/use-student-list";
import { usePageReveal } from "@/lib/use-page-reveal";
import { buildRollCsv, downloadCsv } from "@/lib/csv";
import { useSchoolName } from "@/lib/school";
import { AttendanceTable } from "@/components/dashboard/AttendanceTable";
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
import { toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";

/**
 * The two orders the roll offers. "Run order" is deliberately not among them: a
 * child's place in a run is a fact about a day, and this screen is not scoped to
 * one.
 */
const SORT_IDS: readonly StudentSort[] = ["name", "grade"];

const SORT_LABEL_KEY: Record<StudentSort, MessageKey> = {
  runOrder: "students.sort.runOrder",
  name: "students.sort.name",
  grade: "students.sort.grade",
};

/**
 * Students — the school roll, and nothing else. One row per child with the
 * child's presence over the retention window: present days, absent days,
 * attendance and the last recorded day.
 *
 * The day's runs are deliberately NOT here. A single day is answered where it is
 * already sliced the two ways people ask it: per bus on the live monitor (a
 * route opens that bus's sheet) and per class on Reports. This screen used to
 * carry a date picker that switched it into that day view, which made it a
 * second Reports screen wearing the roll's title.
 */
export default function StudentsPage() {
  const { t, tp, locale } = useLocale();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const schoolName = useSchoolName();

  const [historyStudent, setHistoryStudent] = useState<string | null>(null);
  // Correcting a name or grade: the only student fields this screen writes. The
  // bus belongs to Assignments, where the grant and the audit entry live.
  const [editing, setEditing] = useState<EditableStudent | null>(null);

  // One read: every child in the school, summarised over the window. Nothing on
  // this screen is scoped to a date, so no day query is made.
  const roll = useSchoolRoll();
  const summary = useRollSummary(true);
  const rows = useMemo(
    () =>
      roll.students.map((student) =>
        rollRow(student, summary.byStudentId.get(student.id)),
      ),
    [roll.students, summary.byStudentId],
  );
  const list = useStudentList(rows, "name");

  const loading = roll.live && (roll.loading || summary.loading);
  const live = roll.live;

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
    // The roll's columns are presence over the window, not a run: exporting
    // day-shaped rows here would write "--:--:--" times into a spreadsheet.
    downloadCsv(
      `students-roll-${todayDateStr()}.csv`,
      buildRollCsv(list.filtered, summary.byStudentId, t, locale),
    );
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
            <div className="flex-none text-end">
              <p className="text-[12px] text-dash-on-surface-variant">
                {tp("students.meta", list.total, {
                  count: digits(list.total),
                  sort: t(SORT_LABEL_KEY[list.sort]),
                })}
              </p>
              <p className="text-[11.5px] leading-4 text-dash-on-surface-variant">
                {t("students.retention")}
              </p>
            </div>
          </div>

          <StudentsToolbar list={list} />

          {live && loading ? (
            <div role="status" aria-label={t("dashboard.loading")}>
              <RollSkeleton />
            </div>
          ) : (
            <div data-tour="students-history" className="flex flex-col gap-3">
              <AttendanceTable
                rows={list.paged}
                summaries={summary.byStudentId}
                hasFilters={list.hasFilters}
                onViewHistory={setHistoryStudent}
                onEdit={(row) =>
                  setEditing({
                    id: row.id,
                    name: row.name,
                    grade: row.grade,
                    busId: row.busId || null,
                  })
                }
              />
              <PaginationBar pagination={list} />
            </div>
          )}
        </section>
      </div>

      <StudentHistorySheet
        studentName={historyStudent}
        onClose={() => setHistoryStudent(null)}
      />

      <EditStudentDialog
        student={editing}
        classOptions={list.grades}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

/**
 * Search, then the value selectors the roll is read by, then the clear action.
 * Every control is an Arc control with `arc-field` so the outlined edge keeps
 * its 3:1 step; the phone wraps them, the desktop keeps one row.
 */
function StudentsToolbar({ list }: { list: StudentListState }) {
  const { t, locale } = useLocale();

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
          label={t(SORT_LABEL_KEY[list.sort])}
          align="start"
          triggerClassName="arc-field"
          items={SORT_IDS.map((id) => ({
            label: t(SORT_LABEL_KEY[id]),
            checked: list.sort === id,
            onSelect: () => list.setSort(id),
          }))}
        />

        <DropdownMenu
          ariaLabel={t("studentList.gradeAria")}
          label={
            list.grade
              ? translateDataLabel(list.grade, locale, t)
              : t("studentList.allGrades")
          }
          align="start"
          triggerClassName="arc-field"
          // From four classes up the list is scannable rather than read top to
          // bottom, and the field is one row. The leading "All classes" row is a
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
