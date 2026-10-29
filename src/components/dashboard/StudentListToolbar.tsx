import { Icon } from "@/components/Icon";
import { Button } from "@/components/arc/button/button";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { ExpandingSearch } from "@/components/arc/expanding-search/expanding-search";
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
 *
 * Phone: search and grade share one 44px row, the status filters become a
 * scroll-snapping chip row with a 44px clear button beside it, and inputs use
 * 16px text so iOS does not zoom the page on focus. `md:contents` dissolves
 * those two phone rows, and the order utilities put the children back in the
 * desktop reading order (search, statuses, grade, clear).
 */
export function StudentListToolbar({ list }: { list: StudentListState }) {
  const { t, locale } = useLocale();

  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      {/* Phone row 1: search + grade. */}
      <div className="flex items-center gap-2 md:contents">
        <div className="group/search min-w-0 flex-1 md:order-1 md:w-56 md:flex-none">
          <ExpandingSearch
            anchor="start"
            label={t("studentList.searchAria")}
            placeholder={t("studentList.searchPlaceholder")}
            clearLabel={t("mobile.clearSearchAria")}
            value={list.query}
            onValueChange={list.setQuery}
          />
        </div>

        <DropdownMenu
          ariaLabel={t("studentList.gradeAria")}
          label={list.grade ? translateDataLabel(list.grade, locale, t) : t("studentList.allGrades")}
          align="start"
          matchTriggerWidth
          triggerClassName="arc-field flex-none md:order-3"
          items={[
            {
              label: t("studentList.allGrades"),
              checked: !list.grade,
              onSelect: () => list.setGrade(null),
            },
            ...list.grades.map((g) => ({
              label: translateDataLabel(g, locale, t),
              checked: g === list.grade,
              onSelect: () => list.setGrade(g),
            })),
          ]}
        />
      </div>

      {/* Phone row 2: a scrolling chip rail, with clear pinned beside it. */}
      <div className="flex min-w-0 items-center gap-2 md:contents">
        <div className="no-scrollbar flex h-12 min-w-0 flex-1 snap-x items-center gap-0.5 overflow-x-auto rounded-md border border-dash-control-outline bg-dash-surface-container-low p-0.5 md:order-2 md:h-9 md:max-w-full md:flex-none md:snap-none">
          {STUDENT_STATUS_FILTERS.map((s) => {
            const isActive = list.status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={isActive}
                onClick={() => list.setStatus(s)}
                className={`press flex h-11 flex-none snap-start items-center whitespace-nowrap rounded px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary md:h-8 md:px-2.5 md:text-[12.5px] ${
                  isActive
                    ? "bg-dash-selected-surface font-medium text-dash-on-surface"
                    : "text-dash-on-surface-variant md:hover:text-dash-on-surface"
                }`}
              >
                {statusFilterLabel(s, t)}
              </button>
            );
          })}
        </div>

        {list.hasFilters && (
          <Button
            type="button"
            onClick={list.clearFilters}
            aria-label={t("studentList.clear")}
            variant="secondary"
            size="md"
            className="arc-field flex-none md:order-4"
          >
            <Icon name="filter_alt_off" size={16} variant="outlined" />
            <span className="hidden md:inline">{t("studentList.clear")}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
