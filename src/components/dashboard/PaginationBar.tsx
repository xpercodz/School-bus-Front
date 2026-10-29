import { Pagination } from "@/components/arc/pagination/pagination";
import type { Pagination as PaginationState } from "@/lib/use-page-slice";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits } from "@/lib/i18n/format";

interface PaginationBarProps {
  /** Any paged list: the roster, a loaded cursor page, one student's history. */
  pagination: PaginationState;
}

/**
 * "Showing X–Y of Z" beside the Arc page strip. The strip is
 * `@uiarc/pagination`: a five-number window whose numbers travel like a belt as
 * the window shifts, with one shared mark gliding to the current page.
 *
 * Hidden entirely when there are no rows; the strip itself hides on a single
 * page, so a one-page list keeps only the count line.
 */
export function PaginationBar({ pagination }: PaginationBarProps) {
  const { t, locale } = useLocale();
  if (pagination.total === 0) return null;

  const digits = (n: number) => toLocaleDigits(String(n), locale);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className="min-w-0 text-[12.5px] text-dash-on-surface-variant">
        {t("pagination.showing", {
          start: digits(pagination.start),
          end: digits(pagination.end),
          total: digits(pagination.total),
        })}
      </p>

      {pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          pageCount={pagination.totalPages}
          onPageChange={pagination.setPage}
          label={t("pagination.navAria")}
          labels={{
            previous: t("pagination.previous"),
            next: t("pagination.next"),
            page: (number) => t("pagination.pageNumber", { page: digits(number) }),
          }}
        />
      )}
    </div>
  );
}
