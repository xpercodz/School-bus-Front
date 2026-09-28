import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { HistoryListSkeleton } from "@/components/RosterSkeleton";
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("history.title")}
      placement="bottom"
    >
      <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
        <h2 className="text-headline-md text-on-surface">{t("history.title")}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("dialog.close")}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-4 py-2">
        {loading && entries.length === 0 ? (
          <div role="status" aria-label={t("history.loading")}>
            <HistoryListSkeleton />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Icon name="history" size={32} className="text-on-surface-variant" />
            <p className="text-body-md text-on-surface-variant">
              {t("history.empty")}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-body-md font-medium text-on-surface">
                    {formatDate(entry.date, locale)}
                  </p>
                  <p className="text-body-md text-on-surface-variant">
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
                  className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1 text-label-lg uppercase ${STATUS_META[entry.status].pillClassName}`}
                >
                  <Icon name={STATUS_META[entry.status].icon} size={16} />
                  {t(statusKey(entry.status))}
                </span>
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="mb-4 mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-outline text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            {t("history.loadMore")}
          </button>
        )}
      </div>
    </Dialog>
  );
}
