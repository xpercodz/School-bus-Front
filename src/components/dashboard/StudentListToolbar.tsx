import { Icon } from "@/components/Icon";
import { STUDENT_STATUS_FILTERS, type StudentStatusFilter } from "@/data/dashboard";
import type { StudentListState } from "@/lib/use-student-list";
import { useLocale } from "@/lib/i18n/context";
import { statusKey, translateDataLabel } from "@/lib/i18n/format";
import type { TFunction } from "@/lib/i18n/types";

interface StudentListToolbarProps {
  list: StudentListState;
}

/** Label for a status-filter option — "All" reuses the tabs key, others map to statuses. */
function statusFilterLabel(s: StudentStatusFilter, t: TFunction): string {
  return s === "ALL" ? t("tabs.all") : t(statusKey(s));
}

/**
 * Search + status + grade filters above the student table. Controlled by the
 * `useStudentList` state, so the same filters drive export and pagination.
 */
export function StudentListToolbar({ list }: StudentListToolbarProps) {
  const { t, locale } = useLocale();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search by student name */}
      <div className="relative w-56 max-w-sm">
        <Icon
          name="search"
          size={18}
          variant="outlined"
          className="absolute start-3 top-1/2 -translate-y-1/2 text-dash-outline"
        />
        <input
          aria-label={t("studentList.searchAria")}
          type="text"
          value={list.query}
          onChange={(e) => list.setQuery(e.target.value)}
          placeholder={t("studentList.searchPlaceholder")}
          className="h-10 w-full rounded border border-dash-outline-variant bg-dash-surface ps-9 pe-3 text-dash-body-sm text-dash-on-surface transition-all placeholder:text-dash-outline focus:border-dash-primary focus:outline-none focus:ring-1 focus:ring-dash-primary"
        />
      </div>

      {/* Status segmented control — All / Boarded / Waiting / Dropped Off / Absent */}
      <div
        role="group"
        aria-label={t("studentList.statusAria")}
        className="flex h-10 items-center rounded border border-dash-outline-variant bg-dash-surface p-1"
      >
        {STUDENT_STATUS_FILTERS.map((s) => {
          const isActive = list.status === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={isActive}
              onClick={() => list.setStatus(s)}
              className={`h-full rounded px-3 text-dash-label-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary ${
                isActive
                  ? "bg-dash-primary-container font-bold text-dash-on-primary-container"
                  : "text-dash-on-surface-variant transition-colors hover:text-dash-on-surface"
              }`}
            >
              {statusFilterLabel(s, t)}
            </button>
          );
        })}
      </div>

      {/* Grade filter */}
      <select
        aria-label={t("studentList.gradeAria")}
        value={list.grade ?? ""}
        onChange={(e) => list.setGrade(e.target.value || null)}
        className="h-10 rounded border border-dash-outline-variant bg-dash-surface px-3 text-dash-body-sm text-dash-on-surface focus:border-dash-primary focus:outline-none focus:ring-1 focus:ring-dash-primary"
      >
        <option value="">{t("studentList.allGrades")}</option>
        {list.grades.map((g) => (
          <option key={g} value={g}>
            {translateDataLabel(g, locale, t)}
          </option>
        ))}
      </select>

      {/* Clear all filters — only shown when one is active */}
      {list.hasFilters && (
        <button
          type="button"
          onClick={list.clearFilters}
          className="flex h-10 items-center gap-1 rounded px-2 text-dash-label-md text-dash-primary transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
        >
          <Icon name="filter_alt_off" size={16} variant="outlined" />
          {t("studentList.clear")}
        </button>
      )}
    </div>
  );
}
