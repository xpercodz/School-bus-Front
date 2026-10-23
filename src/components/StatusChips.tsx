import type { StudentStatus } from "@/data/students";
import { AnimatedNumber } from "@/components/AnimatedNumber";
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
 * The run's totals as one divided strip, plus the proportion bar. Four chips
 * did not fit 390px (the last one was clipped), and four separate cards pushed
 * the first student below the fold — one divided strip says the same thing in
 * half the height.
 *
 * Counts tween when attendance changes, and the bar's segments grow to their
 * new share in place, so a tap reads as a change in the run rather than a
 * silent re-render.
 */
export function StatusChips({ counts }: StatusChipsProps) {
  const { t, locale } = useLocale();
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const digits = (value: number) => toLocaleDigits(String(value), locale);

  return (
    <section
      aria-label={t("mobile.summaryAria")}
      data-page-reveal className="lift overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest"
    >
      <div className="grid grid-cols-4 divide-x divide-outline-variant">
        {CELLS.map((cell) => (
          <div key={cell.status} className="px-1 py-3 text-center">
            <AnimatedNumber
              value={counts[cell.status]}
              format={digits}
              className="text-[20px] font-semibold leading-6 tabular-nums text-on-surface"
            />
            <p className="mt-0.5 flex items-start justify-center gap-1 text-[11px] leading-4 text-on-surface-variant">
              <span
                className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${
                  counts[cell.status] > 0 ? cell.dot : "bg-outline-variant"
                }`}
                aria-hidden="true"
              />
              <span className="min-w-0 text-center">{t(cell.label)}</span>
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
                className={`${cell.dot} h-full transition-[width] duration-[var(--t-data)] ease-[var(--ease-out-soft)] motion-reduce:transition-none`}
                style={{ width: `${(counts[cell.status] / total) * 100}%` }}
              />
            ) : null,
          )}
      </div>
    </section>
  );
}
