import { useMemo, useState } from "react";
import type { GradeSummary } from "@/lib/school-data";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { PaginationBar } from "@/components/dashboard/PaginationBar";
import { usePageSlice } from "@/lib/use-page-slice";
import type { MessageKey } from "@/lib/i18n/types";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

/**
 * Classes, one card each — the Reports replacement for the by-grade table.
 *
 * A card is a single button (the whole card opens the class's students), so the
 * grid needs no other action affordance. Two whole rows of four per page, and
 * every class count is read from the same `GradeSummary` the card draws, so the
 * bar, the words and the percentage can never disagree.
 */

type SortKey = "grade" | "absent" | "completion" | "size";

/** Menu order: the default first, then the three "what needs attention" sorts. */
const SORT_KEYS: readonly SortKey[] = ["grade", "absent", "completion", "size"];

const SORT_LABEL_KEY: Record<SortKey, MessageKey> = {
  grade: "reports.sort.grade",
  absent: "reports.sort.absent",
  completion: "reports.sort.completion",
  size: "reports.sort.size",
};

/** Two rows of four — the grid's own page size, not the app's 10. */
const CLASSES_PER_PAGE = 8;

/** The bar's segments, in reading order. A zero-width part is not rendered. */
const BAR_TONES = {
  boarded: "bg-dash-success",
  dropped: "bg-dash-primary",
  unrecorded: "bg-dash-outline",
  absent: "bg-dash-error",
} as const;

interface ClassGridProps {
  /** One row per class, from `summarizeByGrade(rows)`. */
  classes: readonly GradeSummary[];
  onOpenClass: (grade: string) => void;
}

export function ClassGrid({ classes, onOpenClass }: ClassGridProps) {
  const { t, locale } = useLocale();
  const digits = (n: number) => toLocaleDigits(String(n), locale);

  const [sortKey, setSortKey] = useState<SortKey>("grade");
  const [query, setQuery] = useState<string | null>(null);

  const students = useMemo(
    () => classes.reduce((sum, row) => sum + row.assigned, 0),
    [classes],
  );

  // The dropdown lists every class in grade order whatever the grid is sorted
  // by or filtered to — it is a picker, not a view of the current sort.
  const options = useMemo(() => {
    const byName = (a: GradeSummary, b: GradeSummary) =>
      translateDataLabel(a.grade, locale, t).localeCompare(
        translateDataLabel(b.grade, locale, t),
        locale,
      );
    return [...classes].sort(byName);
  }, [classes, locale, t]);

  const sorted = useMemo(() => {
    const byName = (a: GradeSummary, b: GradeSummary) =>
      translateDataLabel(a.grade, locale, t).localeCompare(
        translateDataLabel(b.grade, locale, t),
        locale,
      );
    const completion = (row: GradeSummary) =>
      row.assigned === 0 ? 0 : (row.boarded + row.droppedOff) / row.assigned;
    const visible = query ? classes.filter((row) => row.grade === query) : classes;
    return [...visible].sort((a, b) => {
      switch (sortKey) {
        case "absent":
          return b.absent - a.absent || byName(a, b);
        case "completion":
          return completion(a) - completion(b) || byName(a, b);
        case "size":
          return b.assigned - a.assigned || byName(a, b);
        default:
          return byName(a, b);
      }
    });
  }, [classes, query, sortKey, locale, t]);

  // Eight classes a page (two whole rows of four). A new sort or a new class
  // filter is a new question, so the page returns to the first.
  const page = usePageSlice(sorted, CLASSES_PER_PAGE, sortKey + (query ?? ""));

  return (
    <section
      aria-labelledby="reports-classes-title"
      className="flex flex-col gap-3 print:break-inside-avoid"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id="reports-classes-title"
          className="text-[15px] font-semibold text-dash-on-surface"
        >
          {t("reports.classes")}
        </h2>
        <p className="text-[12.5px] leading-4 text-dash-on-surface-variant">
          {t("reports.classesMeta", {
            classes: digits(classes.length),
            students: digits(students),
          })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu
          label={t(SORT_LABEL_KEY[sortKey])}
          ariaLabel={t("reports.sortAria")}
          align="start"
          triggerClassName="arc-field"
          items={SORT_KEYS.map((key) => ({
            label: t(SORT_LABEL_KEY[key]),
            checked: key === sortKey,
            onSelect: () => setSortKey(key),
          }))}
        />
        <DropdownMenu
          label={
            query ? translateDataLabel(query, locale, t) : t("reports.allClasses")
          }
          badge={digits(sorted.length)}
          align="start"
          triggerClassName="arc-field"
          // Same rule as the other data-driven selectors: a school with more
          // than six classes gets the search field, a small one keeps the plain
          // menu. The leading "All classes" row is a filter reset, not an
          // option, so it is not counted. This menu keeps its class-specific
          // copy ("Search a class…") rather than the generic dropdown strings.
          searchable={
            options.length >= 4
              ? {
                  placeholder: t("reports.classSearchPlaceholder"),
                  emptyLabel: t("reports.classSearchEmpty"),
                }
              : undefined
          }
          items={[
            {
              label: t("reports.allClasses"),
              meta: digits(students),
              checked: query === null,
              onSelect: () => setQuery(null),
            },
            ...options.map((row) => ({
              label: translateDataLabel(row.grade, locale, t),
              meta: digits(row.assigned),
              checked: row.grade === query,
              onSelect: () => setQuery(row.grade),
            })),
          ]}
        />
        <p className="ms-auto text-[12.5px] leading-4 text-dash-on-surface-variant">
          {t("reports.openClassHint")}
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="px-1 py-6 text-[13px] leading-5 text-dash-on-surface-variant">
          {/* Two different empties: a filter that matched nothing, and a day
              with no classes at all. */}
          {classes.length === 0
            ? t("reports.emptySubtitle")
            : t("reports.classSearchEmpty")}
        </p>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1180px]:grid-cols-4">
          {page.paged.map((row) => (
            <ClassCard key={row.grade} row={row} onOpen={() => onOpenClass(row.grade)} />
          ))}
        </div>
        {/* Print paints the whole document at once and cannot be paged: the
            classes past the visible page would silently vanish from a printed
            report, so the rest render only on paper. */}
        {sorted.length > page.paged.length && (
          <div className="hidden grid-cols-4 gap-3 print:grid">
            {sorted.slice(page.paged.length).map((row) => (
              <ClassCard key={row.grade} row={row} onOpen={() => onOpenClass(row.grade)} />
            ))}
          </div>
        )}
        </>
      )}

      <PaginationBar pagination={page} />
    </section>
  );
}

/** One class: name + roster size, the four-part proportion, then the words. */
function ClassCard({
  row,
  onOpen,
}: {
  row: GradeSummary;
  onOpen: () => void;
}) {
  const { t, locale } = useLocale();
  const digits = (n: number) => toLocaleDigits(String(n), locale);

  const name = translateDataLabel(row.grade, locale, t);
  const completion =
    row.assigned === 0
      ? 0
      : Math.round(((row.boarded + row.droppedOff) / row.assigned) * 100);

  const parts = [
    { key: "boarded", value: row.boarded, tone: BAR_TONES.boarded, label: t("status.boarded") },
    { key: "dropped", value: row.droppedOff, tone: BAR_TONES.dropped, label: t("fleet.sectionDropped") },
    { key: "unrecorded", value: row.waiting, tone: BAR_TONES.unrecorded, label: t("busDetail.unaccounted") },
    { key: "absent", value: row.absent, tone: BAR_TONES.absent, label: t("status.absent") },
  ];

  // Non-zero counts in words, in the bar's own order.
  const words = parts
    .filter((part) => part.value > 0)
    .map((part) => `${digits(part.value)} ${part.label}`)
    .join(" · ");

  // The bar is one image; the counts it draws are spelled out for a reader.
  const barLabel = `${name}, ${t("reports.classCount", {
    count: digits(row.assigned),
  })}: ${parts.map((part) => `${digits(part.value)} ${part.label}`).join(", ")}`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full cursor-pointer flex-col gap-2.5 rounded-lg border border-dash-outline-variant bg-dash-surface p-3.5 text-start transition-colors hover:bg-dash-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-primary"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[13.5px] font-semibold text-dash-on-surface">
          {name}
        </span>
        <span className="flex-none text-[11.5px] leading-4 text-dash-on-surface-variant">
          {t(row.assigned === 1 ? "reports.classCountOne" : "reports.classCount", {
            count: digits(row.assigned),
          })}
        </span>
      </span>

      <span
        role="img"
        aria-label={barLabel}
        className="flex h-1 w-full overflow-hidden rounded-full bg-dash-surface-container"
      >
        {parts.map((part) =>
          part.value > 0 ? (
            <span
              key={part.key}
              aria-hidden="true"
              className={`h-full flex-none ${part.tone}`}
              style={{ width: `${(part.value / row.assigned) * 100}%` }}
            />
          ) : null,
        )}
      </span>

      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-[11.5px] leading-4 text-dash-on-surface-variant">
          {words}
        </span>
        <span className="flex-none text-[12.5px] font-semibold tabular-nums text-dash-on-surface">
          {digits(completion)}%
        </span>
      </span>
    </button>
  );
}
