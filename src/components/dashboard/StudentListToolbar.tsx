import { Icon } from "@/components/Icon";
import { STUDENT_STATUS_FILTERS, type StudentStatusFilter } from "@/data/dashboard";
import type { StudentListState } from "@/lib/use-student-list";
import { useLocale } from "@/lib/i18n/context";
import { statusKey, translateDataLabel } from "@/lib/i18n/format";
import type { TFunction } from "@/lib/i18n/types";

/** Label for a status-filter option — "All" reuses the tabs key, others map to statuses. */
function statusFilterLabel(s: StudentStatusFilter, t: TFunction): string {
  return s === "ALL" ? t("tabs.all") : t(statusKey(s));
}

/**
 * Search + status + grade filters above the roster. Controlled by the shared
 * `useStudentList` state, so the same filters drive export and pagination.
 */
export function StudentListToolbar({ list }: { list: StudentListState }) {
  const { t, locale } = useLocale();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-56">
        <Icon
          name="search"
          size={16}
          variant="outlined"
          className="absolute start-3 top-1/2 -translate-y-1/2 text-dash-outline"
        />
        <input
          aria-label={t("studentList.searchAria")}
          type="text"
          value={list.query}
          onChange={(e) => list.setQuery(e.target.value)}
          placeholder={t("studentList.searchPlaceholder")}
          className="h-9 w-full rounded-md border border-dash-outline-variant bg-dash-surface ps-9 pe-3 text-[13px] text-dash-on-surface placeholder:text-dash-on-surface-variant focus:border-dash-primary focus:outline-none focus:ring-1 focus:ring-dash-primary"
        />
      </div>

      <div className="no-scrollbar -mx-1 flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md border border-dash-outline-variant bg-dash-surface-container-low p-0.5">
        {STUDENT_STATUS_FILTERS.map((s) => {
          const isActive = list.status === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={isActive}
              onClick={() => list.setStatus(s)}
              className={`h-8 flex-none whitespace-nowrap rounded px-2.5 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary ${
                isActive
                  ? "bg-dash-surface font-medium text-dash-on-surface"
                  : "text-dash-on-surface-variant hover:text-dash-on-surface"
              }`}
            >
              {statusFilterLabel(s, t)}
            </button>
          );
        })}
      </div>

      <select
        aria-label={t("studentList.gradeAria")}
        value={list.grade ?? ""}
        onChange={(e) => list.setGrade(e.target.value || null)}
        className="h-9 rounded-md border border-dash-outline-variant bg-dash-surface px-2.5 text-[12.5px] text-dash-on-surface focus:border-dash-primary focus:outline-none focus:ring-1 focus:ring-dash-primary"
      >
        <option value="">{t("studentList.allGrades")}</option>
        {list.grades.map((g) => (
          <option key={g} value={g}>
            {translateDataLabel(g, locale, t)}
          </option>
        ))}
      </select>

      {list.hasFilters && (
        <button
          type="button"
          onClick={list.clearFilters}
          className="flex h-9 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-dash-on-surface-variant transition-colors hover:bg-dash-surface-container hover:text-dash-on-surface"
        >
          <Icon name="filter_alt_off" size={16} variant="outlined" />
          {t("studentList.clear")}
        </button>
      )}
    </div>
  );
}
