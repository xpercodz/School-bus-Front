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
 *
 * Phone: the numbered window is hidden (it was the real 360px overflow), and
 * the nav becomes 44px prev/next around a plain "current / total" readout. From
 * sm up the numbers return at 36px targets.
 */
export function PaginationBar({ list }: PaginationBarProps) {
  const { t, locale, dir } = useLocale();
  if (list.total === 0) return null;

  const digits = (n: number) => toLocaleDigits(String(n), locale);
  // Chevrons are physical glyphs — flip them in RTL so "previous" still points
  // in the reading direction.
  const prevIcon = dir === "rtl" ? "chevron_right" : "chevron_left";
  const nextIcon = dir === "rtl" ? "chevron_left" : "chevron_right";
  const navButtonClass =
    "press flex h-11 w-11 flex-none items-center justify-center rounded-md text-dash-on-surface-variant hover:bg-dash-surface-container hover:text-dash-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className="min-w-0 text-[12.5px] text-dash-on-surface-variant">
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
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label={t("studentList.previousAria")}
              disabled={list.page <= 1}
              onClick={() => list.setPage(list.page - 1)}
              className={navButtonClass}
            >
              <Icon name={prevIcon} size={18} variant="outlined" />
            </button>

            {/* The number window was the widest child on a phone; below sm the
                compact readout carries the same information in ~40px. The nav's
                aria-label already names the page, so it is not repeated. */}
            <span
              aria-hidden="true"
              className="px-1.5 text-[12.5px] font-medium tabular-nums text-dash-on-surface sm:hidden"
            >
              {digits(list.page)} / {digits(list.totalPages)}
            </span>

            <div className="hidden items-center gap-0.5 sm:flex">
              {pageWindow(list.page, list.totalPages).map((p, index) =>
                p === "…" ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-1 text-[12.5px] text-dash-on-surface-variant"
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
                    className={`press flex h-9 min-w-9 items-center justify-center rounded px-2 text-dash-label-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary ${
                      p === list.page
                        ? "bg-dash-on-surface font-medium text-dash-background"
                        : "text-dash-on-surface-variant hover:bg-dash-surface-container"
                    }`}
                  >
                    {digits(p)}
                  </button>
                ),
              )}
            </div>

            <button
              type="button"
              aria-label={t("studentList.nextAria")}
              disabled={list.page >= list.totalPages}
              onClick={() => list.setPage(list.page + 1)}
              className={navButtonClass}
            >
              <Icon name={nextIcon} size={18} variant="outlined" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
