import { Icon } from "@/components/Icon";
import type { StudentListState } from "@/lib/use-student-list";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits } from "@/lib/i18n/format";

interface PaginationBarProps {
  list: StudentListState;
}

/** Page-number window around the current page, with ellipses at the gaps. */
function pageWindow(current: number, total: number, span = 2): (number | "…")[] {
  if (total <= span * 2 + 3) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - span);
  const end = Math.min(total - 1, current + span);
  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

/**
 * Prev / numbered pages / Next plus a "Showing X–Y of Z" line. Hidden entirely
 * when there are no rows; the numeric controls hide on a single page.
 */
export function PaginationBar({ list }: PaginationBarProps) {
  const { t, locale, dir } = useLocale();
  if (list.total === 0) return null;

  const digits = (n: number) => toLocaleDigits(String(n), locale);
  // Chevrons are physical glyphs — flip them in RTL so "previous" still points
  // in the reading direction.
  const prevIcon = dir === "rtl" ? "chevron_right" : "chevron_left";
  const nextIcon = dir === "rtl" ? "chevron_left" : "chevron_right";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-dash-body-sm text-dash-on-surface-variant">
        {t("studentList.showing", {
          start: digits(list.start),
          end: digits(list.end),
          total: digits(list.total),
        })}
      </p>

      {list.totalPages > 1 && (
        <nav
          aria-label={t("studentList.pageAria", {
            page: digits(list.page),
            pages: digits(list.totalPages),
          })}
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t("studentList.previousAria")}
              disabled={list.page <= 1}
              onClick={() => list.setPage(list.page - 1)}
              className="flex h-9 w-9 items-center justify-center rounded text-dash-on-surface-variant transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name={prevIcon} size={18} variant="outlined" />
            </button>
            {pageWindow(list.page, list.totalPages).map((p, index) =>
              p === "…" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1 text-dash-body-sm text-dash-on-surface-variant"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  aria-current={p === list.page ? "page" : undefined}
                  onClick={() => list.setPage(p)}
                  className={`flex h-9 min-w-9 items-center justify-center rounded px-2 text-dash-label-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary ${
                    p === list.page
                      ? "bg-dash-primary-container font-bold text-dash-on-primary-container"
                      : "text-dash-on-surface-variant transition-colors hover:bg-dash-surface-container-high"
                  }`}
                >
                  {digits(p)}
                </button>
              ),
            )}
            <button
              type="button"
              aria-label={t("studentList.nextAria")}
              disabled={list.page >= list.totalPages}
              onClick={() => list.setPage(list.page + 1)}
              className="flex h-9 w-9 items-center justify-center rounded text-dash-on-surface-variant transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name={nextIcon} size={18} variant="outlined" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
