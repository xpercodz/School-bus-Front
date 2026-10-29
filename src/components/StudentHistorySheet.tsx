import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/arc/button/button";
import { Icon } from "@/components/Icon";
import { staggerStyle } from "@/lib/motion";
import { HistoryListSkeleton } from "@/components/RosterSkeleton";
import { PaginationBar } from "@/components/dashboard/PaginationBar";
import { useAutoLoadMore, usePageSlice } from "@/lib/use-page-slice";
import { STATUS_META } from "@/data/students";
import { useStudentHistory } from "@/lib/school-data";
import { useLocale } from "@/lib/i18n/context";
import { formatDate, statusKey, translateDataLabel } from "@/lib/i18n/format";

interface StudentHistorySheetProps {
  /** Student to show history for; null (or closed) hides the sheet. */
  studentName: string | null;
  onClose: () => void;
}

/**
 * Attendance history for one student, shared by the dashboard row action and the
 * mobile kebab menu. Renders as a bottom sheet; queries Firestore (paginated)
 * when live, else a small demo list.
 *
 * The sheet itself scrolls inside the Dialog's 88dvh panel; the title row is
 * pinned to the top of that scroll area so the 44px close target never leaves
 * the screen while a long history is scrolled.
 */
export function StudentHistorySheet({
  studentName,
  onClose,
}: StudentHistorySheetProps) {
  const { t, locale } = useLocale();
  const open = studentName !== null;
  const { entries, loading, hasMore, loadMore } = useStudentHistory(
    studentName,
    open,
  );
  // Ten rows a page over the loaded history, and the next cursor page is fetched
  // as soon as the last loaded page is reached.
  const historyPage = usePageSlice(entries, 10, studentName);
  useAutoLoadMore(historyPage, { hasMore, loading, loadMore });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("history.title")}
      placement="bottom"
      // Closing sets studentName to null, which clears the paginated entries;
      // an exit beat would animate the empty state out. Close instantly.
      exitAnimation={false}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-outline-variant bg-surface px-4 py-2.5">
        <h2 className="min-w-0 truncate text-[18px] font-semibold text-on-surface">
          {t("history.title")}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="md"
          icon
          className="flex-none"
          onClick={onClose}
          aria-label={t("dialog.close")}
        >
          <Icon name="close" size={22} />
        </Button>
      </header>

      <div className="px-4 pb-4 pt-1">
        {loading && entries.length === 0 ? (
          <div role="status" aria-label={t("history.loading")}>
            <HistoryListSkeleton />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Icon name="history" size={32} className="text-on-surface-variant" />
            <p className="text-[15px] text-on-surface-variant">
              {t("history.empty")}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {historyPage.paged.map((entry, index) => (
              <li
                key={entry.id}
                className="stagger-in flex items-start justify-between gap-3 py-3.5"
                style={staggerStyle(index, entries.length)}
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-on-surface">
                    {formatDate(entry.date, locale)}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-5 text-on-surface-variant">
                    {t(
                      entry.runType === "afternoon"
                        ? "runType.afternoonDropoff"
                        : "runType.morningPickup",
                    )}
                    {" · "}
                    {translateDataLabel(entry.busName, locale, t)}
                  </p>
                </div>
                <span
                  className={`inline-flex flex-none items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-[12px] font-medium ${STATUS_META[entry.status].pillClassName}`}
                >
                  <Icon name={STATUS_META[entry.status].icon} size={16} />
                  {t(statusKey(entry.status))}
                </span>
              </li>
            ))}
          </ul>
        )}

        {historyPage.totalPages > 1 && (
          <PaginationBar pagination={historyPage} />
        )}
      </div>
    </Dialog>
  );
}
