import { useMemo, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/arc/button/button";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import type { AdminBus, AdminStudent } from "@/lib/school-admin";
import {
  applyAssignmentPlan,
  buildAssignmentPlan,
  guessColumns,
  type ColumnMatch,
  type ImportField,
  type ParsedSheet,
} from "@/lib/sheet-import";

/** The four destinations a sheet column can land in, in menu order. */
const FIELDS: readonly ImportField[] = ["studentName", "grade", "bus", "ignore"];

const FIELD_KEY: Record<ImportField, MessageKey> = {
  studentName: "sheet.field.studentName",
  grade: "sheet.field.grade",
  bus: "sheet.field.bus",
  ignore: "sheet.field.ignore",
};

/** The fields the preview can show, in the app's own column order. */
const PREVIEW_FIELDS = FIELDS.filter((field) => field !== "ignore");

/** Excel-style column letters: 0 → A, 25 → Z, 26 → AA. */
function columnLetter(index: number): string {
  let value = index + 1;
  let letter = "";
  while (value > 0) {
    const rest = (value - 1) % 26;
    letter = String.fromCharCode(65 + rest) + letter;
    value = Math.floor((value - 1) / 26);
  }
  return letter;
}

/**
 * One row per sheet column, with every column present: a guess that found
 * nothing is an "ignore" row rather than a missing one, so the director sees
 * the whole sheet and can correct it.
 */
function matchColumns(sheet: ParsedSheet): ColumnMatch[] {
  const guessed = new Map(guessColumns(sheet.columns).map((match) => [match.index, match] as const));
  return sheet.columns.map((header, index) => {
    const guess = guessed.get(index);
    return {
      index,
      header,
      field: guess?.field ?? "ignore",
      via: guess?.via ?? null,
    };
  });
}

interface SheetImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** The parsed file; null until a sheet has been read. */
  sheet: ParsedSheet | null;
  /** The school's current students (read by the page — not re-queried here). */
  students: readonly AdminStudent[];
  /** The school's buses, the destination names the sheet's bus column resolves to. */
  buses: readonly AdminBus[];
  /** Called after the write so the page can refresh its per-bus figures. */
  onApplied: (moved: number) => void;
}

/**
 * The import's second and last step: match the sheet's columns to ours, see
 * where each one lands, and only then write. Every figure in the result strip
 * is computed live by `buildAssignmentPlan` from the current mapping, so
 * "Apply N moves" can never disagree with the preview above it.
 *
 * On a phone this is the Dialog's bottom sheet; from sm up it is the wide
 * centered panel. The mapping rows stack below 761px and the target keeps a
 * fixed 220px column above it, like the approved preview.
 */
export function SheetImportDialog({
  open,
  onClose,
  sheet,
  students,
  buses,
  onApplied,
}: SheetImportDialogProps) {
  const { t } = useLocale();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("sheet.mappingTitle")}
      // Closing unmounts the body (the mapping is per file), so an exit beat
      // would animate an empty panel out.
      exitAnimation={false}
      panelClassName="w-full max-w-[880px] max-h-[88dvh] rounded-t-2xl bg-dash-surface pb-[env(safe-area-inset-bottom)] sm:max-h-[85dvh] sm:rounded-xl sm:pb-0"
    >
      {open && sheet && (
        <SheetImportBody
          sheet={sheet}
          students={students}
          buses={buses}
          onApplied={onApplied}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function SheetImportBody({
  sheet,
  students,
  buses,
  onApplied,
  onClose,
}: {
  sheet: ParsedSheet;
  students: readonly AdminStudent[];
  buses: readonly AdminBus[];
  onApplied: (moved: number) => void;
  onClose: () => void;
}) {
  const { t, locale, dir } = useLocale();
  const { user } = useAuth();
  const uid = user?.uid;
  const { showToast } = useToast();
  const digits = (value: number) => toLocaleDigits(String(value), locale);

  const [matches, setMatches] = useState<ColumnMatch[]>(() => matchColumns(sheet));
  const [applying, setApplying] = useState(false);

  // The plan is the single source of truth for all four numbers on this
  // screen: it is rebuilt on every mapping change, never mirrored in state.
  const plan = useMemo(
    () => buildAssignmentPlan({ sheet, matches, students, buses }),
    [sheet, matches, students, buses],
  );
  const moveCount = plan.rows.length;

  // Index of the first column mapped to each field — the preview shows one
  // column per field even if the sheet repeats one.
  const columnOf = useMemo(() => {
    const map = new Map<ImportField, number>();
    for (const match of matches) {
      if (match.field !== "ignore" && !map.has(match.field)) map.set(match.field, match.index);
    }
    return map;
  }, [matches]);
  const previewFields = PREVIEW_FIELDS.filter((field) => columnOf.has(field));
  const previewRows = sheet.rows.slice(0, 3);
  const matched = matches.filter((match) => match.field !== "ignore").length;

  function setField(index: number, field: ImportField) {
    setMatches((current) =>
      current.map((match) =>
        // A manual choice is the director's own match, so an old alias hint no
        // longer describes it; re-picking the same field keeps the hint.
        match.index === index && match.field !== field
          ? { ...match, field, via: null }
          : match,
      ),
    );
  }

  async function handleApply() {
    if (!uid || moveCount === 0) return;
    setApplying(true);
    try {
      const moved = await applyAssignmentPlan(uid, plan);
      showToast(t("sheet.imported", { count: digits(moved) }));
      onApplied(moved);
      onClose();
    } catch {
      showToast(t("toast.error"));
    } finally {
      setApplying(false);
    }
  }

  // The dictionary strings carry the figure as `{count}`; reading the raw
  // template lets the number keep its own weight without rebuilding the
  // sentence in code (which would break word order in Arabic).
  const figure = (key: MessageKey, count: number) => {
    const [before, after] = t(key).split("{count}");
    return (
      <>
        {before}
        <span className="font-semibold text-dash-on-surface">{digits(count)}</span>
        {after}
      </>
    );
  };

  return (
    <>
      {/* Solid, sticky header: the file's identity and where it came from. */}
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-dash-outline-variant bg-dash-surface-container-low px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold leading-6 text-dash-on-surface sm:text-dash-headline-lg">
            {t("sheet.mappingTitle")}
          </h2>
          <p className="mt-1 break-words text-[12.5px] leading-4 text-dash-on-surface-variant">
            {t("sheet.mappingHint", {
              file: sheet.fileName,
              sheet: sheet.sheetName,
              rows: digits(sheet.rows.length),
            })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="md"
          icon
          className="flex-none"
          onClick={onClose}
          aria-label={t("dialog.close")}
        >
          <Icon name="close" size={20} variant="outlined" />
        </Button>
      </header>

      <div className="flex flex-col gap-5 px-4 py-4 sm:px-6 sm:py-5">
        {/* 1 — the mapping */}
        <section className="flex flex-col gap-1">
          <h3 className="text-[13px] font-semibold text-dash-on-surface">
            {t("sheet.whereEachColumn")}
          </h3>
          <p className="text-[12.5px] leading-5 text-dash-on-surface-variant">
            {t("sheet.whereEachColumnHint", {
              matched: digits(matched),
              total: digits(matches.length),
            })}
          </p>

          <div className="mt-2 divide-y divide-dash-outline-variant">
            {matches.map((match) => {
              const letter = t("sheet.columnLetter", { letter: columnLetter(match.index) });
              const hint =
                match.field === "ignore"
                  ? t("sheet.notMatched")
                  : match.via === "alias"
                    ? t("sheet.matchedOn", { name: match.header })
                    : null;
              return (
                <div
                  key={match.index}
                  className="grid grid-cols-1 gap-2 py-3 min-[761px]:grid-cols-[minmax(0,1fr)_28px_220px] min-[761px]:items-center min-[761px]:gap-3"
                >
                  <div className="min-w-0">
                    <p className="break-words text-[13.5px] font-medium leading-[1.3] text-dash-on-surface">
                      {match.header}
                    </p>
                    <p className="mt-px text-[11.5px] leading-4 text-dash-on-surface-variant">
                      {letter}
                      {hint && <span> · {hint}</span>}
                    </p>
                  </div>
                  {/* The glyph points from the sheet's column to its target;
                      the arrow's direction is the reading direction. */}
                  <Icon
                    name="arrow_forward"
                    size={18}
                    variant="outlined"
                    className={`hidden text-dash-on-surface-variant min-[761px]:block ${
                      dir === "rtl" ? "-scale-x-100" : ""
                    }`}
                  />
                  <DropdownMenu
                    ariaLabel={`${match.header} — ${t(FIELD_KEY[match.field])}`}
                    label={t(FIELD_KEY[match.field])}
                    align="end"
                    matchTriggerWidth
                    triggerClassName="arc-field w-full"
                    items={FIELDS.map((field) => ({
                      label: t(FIELD_KEY[field]),
                      checked: match.field === field,
                      onSelect: () => setField(match.index, field),
                    }))}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* 2 — the preview: only the mapped fields, first three rows */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-dash-on-surface">
            {t("sheet.previewTitle", {
              shown: digits(previewRows.length),
              total: digits(sheet.rows.length),
            })}
          </h3>
          {previewFields.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-dash-outline-variant">
              <div className="overflow-x-auto">
                <table className="table-zebra w-full border-collapse text-start">
                  <thead className="border-b border-dash-outline-variant bg-dash-surface-container-low text-[11.5px] text-dash-on-surface-variant">
                    <tr>
                      {previewFields.map((field) => (
                        <th key={field} scope="col" className="h-9 px-3 py-2 font-medium">
                          {t(FIELD_KEY[field])}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-[12.5px] text-dash-on-surface">
                    {previewRows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {previewFields.map((field, fieldIndex) => {
                          const value = row[columnOf.get(field) ?? -1] ?? "";
                          return fieldIndex === 0 ? (
                            <th
                              key={field}
                              scope="row"
                              className="break-words px-3 py-2 text-start font-medium"
                            >
                              {value}
                            </th>
                          ) : (
                            <td
                              key={field}
                              className="break-words px-3 py-2 text-dash-on-surface-variant"
                            >
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="text-[11.5px] leading-4 text-dash-on-surface-variant">
            {t("sheet.previewNote")}
          </p>
        </section>

        {/* 3 — the result, spoken as a sentence rather than drawn. The
            separator trails its own statement, so a wrapped line never starts
            with a lone dot. */}
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-lg border border-dash-outline-variant bg-dash-surface-container-low px-3 py-2.5 text-[12.5px] leading-5 tabular-nums text-dash-on-surface-variant">
          {(
            [
              { key: "sheet.resultMove", count: moveCount },
              { key: "sheet.resultUnchanged", count: plan.unchanged },
              { key: "sheet.resultUnmatched", count: plan.unmatched.length },
            ] as const
          ).map(({ key, count }, index, all) => (
            <span key={key} className="whitespace-nowrap">
              {figure(key, count)}
              {index < all.length - 1 && (
                <span className="ps-1" aria-hidden="true">
                  ·
                </span>
              )}
            </span>
          ))}
        </p>
      </div>

      <footer className="sticky bottom-0 z-10 mt-auto flex flex-col gap-2 border-t border-dash-outline-variant bg-dash-surface-container-low px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="min-w-0 text-[12.5px] text-dash-on-surface-variant">
          {t("sheet.nothingWritten")}
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="arc-field"
            onClick={onClose}
            disabled={applying}
          >
            {t("sheet.back")}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleApply}
            disabled={moveCount === 0}
            loading={applying}
          >
            {t("sheet.apply", { count: digits(moveCount) })}
          </Button>
        </div>
      </footer>
    </>
  );
}

export default SheetImportDialog;
