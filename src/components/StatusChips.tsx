import type { StudentStatus } from "@/data/students";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";

interface StatusChipsProps {
  counts: Record<StudentStatus, number>;
}

const CELLS: {
  status: StudentStatus;
  label: MessageKey;
  dot: string;
}[] = [
  { status: "BOARDED", label: "mobile.summaryOnboard", dot: "bg-success" },
  { status: "DROPPED_OFF", label: "mobile.summaryDropped", dot: "bg-primary" },
  { status: "WAITING", label: "mobile.summaryWaiting", dot: "bg-waiting" },
  { status: "ABSENT", label: "mobile.summaryAbsent", dot: "bg-error" },
];

/**
 * The run's totals as one strip, plus the proportion bar. Four chips did not
 * fit 390px (the last one was clipped), and four separate cards pushed the
 * first student below the fold — one divided strip says the same thing in half
 * the height.
 */
export function StatusChips({ counts }: StatusChipsProps) {
  const { t, locale } = useLocale();
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <section
      aria-label={t("mobile.summaryAria")}
      className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest"
    >
      <div className="grid grid-cols-4 divide-x divide-outline-variant">
        {CELLS.map((cell) => (
          <div key={cell.status} className="px-1.5 py-2.5 text-center">
            <p className="text-[18px] leading-5 font-semibold tabular-nums text-on-surface">
              {toLocaleDigits(String(counts[cell.status]), locale)}
            </p>
            <p className="mt-1 flex items-center justify-center gap-1 text-[11px] leading-4 text-on-surface-variant">
              <span
                className={`h-1.5 w-1.5 flex-none rounded-full ${
                  counts[cell.status] > 0 ? cell.dot : "bg-outline-variant"
                }`}
                aria-hidden="true"
              />
              <span className="truncate">{t(cell.label)}</span>
            </p>
          </div>
        ))}
      </div>
      <div className="flex h-1.5 w-full gap-0.5 bg-surface-container" aria-hidden="true">
        {total > 0 &&
          CELLS.map((cell) =>
            counts[cell.status] > 0 ? (
              <span
                key={cell.status}
                className={`${cell.dot} h-full`}
                style={{ width: `${(counts[cell.status] / total) * 100}%` }}
              />
            ) : null,
          )}
      </div>
    </section>
  );
}
