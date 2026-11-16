import { useMemo, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/arc/button/button";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/context";
import { localeCode, toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import type { AdminBus, AdminStudent } from "@/lib/school-admin";
import {
  applyAssignmentPlan,
  buildAssignmentPlan,
  guessColumns,
  type AssignmentPlan,
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

/**
 * At most five names, joined the way the locale joins a list, with the rest
 * counted: the point is to recognise a typo, not to print the file.
 */
function nameList(names: readonly string[], locale: string, more: (n: string) => string): string {
  const shown = names.slice(0, 5);
  const joined = new Intl.ListFormat(locale, { style: "short", type: "conjunction" }).format(shown);
  return names.length > shown.length ? `${joined} ${more(String(names.length - shown.length))}` : joined;
}

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
  /**
   * The reader may maintain the roster (a director, or an operator granted
   * Students). Without it the sheet can still move children between buses but
   * cannot create one or set a class — the rules refuse those fields, so the
   * preview must not promise them either.
   */
  canWriteStudents: boolean;
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
  canWriteStudents,
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
          canWriteStudents={canWriteStudents}
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
  canWriteStudents,
  onApplied,
  onClose,
}: {
  sheet: ParsedSheet;
  students: readonly AdminStudent[];
  buses: readonly AdminBus[];
  canWriteStudents: boolean;
  onApplied: (written: number) => void;
  onClose: () => void;
}) {
  const { t, tp, locale, dir } = useLocale();
  const { user } = useAuth();
  const uid = user?.uid;
  const { showToast } = useToast();
  const digits = (value: number) => toLocaleDigits(String(value), locale);

  const [matches, setMatches] = useState<ColumnMatch[]>(() => matchColumns(sheet));
  const [applying, setApplying] = useState(false);
  // The ignored columns' disclosure, closed by default: they are columns this
  // import will not read, so they must not cost a row each. The body mounts per
  // file, so a new sheet starts closed.
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  // "The sheet is the whole roster": on by default, because a re-uploaded
  // roster is how a child leaves. Off is the safe state — nobody is archived.
  const [archiveMissing, setArchiveMissing] = useState(true);

  // The plan is the single source of truth for all four numbers on this
  // screen: it is rebuilt on every mapping change, never mirrored in state.
  const plan = useMemo(
    () => buildAssignmentPlan({ sheet, matches, students, buses }),
    [sheet, matches, students, buses],
  );

  // What will actually be written: without the Students grant, creations, class
  // writes and both directions of the rollover (archiving and restoring) are
  // dropped here rather than refused by the server halfway through a batch.
  // With the toggle off nobody is archived — but a child the sheet names again
  // still comes back, because the toggle is about leaving, not returning.
  const writable = useMemo<AssignmentPlan>(() => {
    if (canWriteStudents) {
      return archiveMissing ? plan : { ...plan, archive: [] };
    }
    return {
      ...plan,
      creates: [],
      rows: plan.rows
        .map((row) => ({ ...row, toClass: null }))
        .filter((row) => row.toBusId !== null),
      archive: [],
      restore: [],
    };
  }, [plan, canWriteStudents, archiveMissing]);
  // Children, not writes: a child restored and corrected in the same import is
  // one change, which is also what `applyAssignmentPlan` counts. The archived
  // and restored children count here, or a sheet that only removes children
  // would report "Apply 0 changes" and write nothing (R12).
  const writeCount =
    new Set([
      ...writable.rows.map((row) => row.studentId),
      ...writable.archive.map((child) => child.id),
      ...writable.restore,
    ]).size + writable.creates.length;
  /**
   * The sheet asks for something this reader may not write. Silent omission
   * would be worse than an outright failure: the same file would appear to
   * "work" while quietly leaving every class alone. Turning archiving off
   * takes the archive half out of the question — nothing of it will be written.
   */
  const blocked =
    !canWriteStudents &&
    (plan.creates.length > 0 ||
      plan.rows.some((row) => row.toClass !== null) ||
      (archiveMissing && plan.archive.length > 0) ||
      plan.restore.length > 0);
  /** The plan has something to say about who leaves or returns. */
  const hasRollover = plan.archive.length > 0 || plan.restore.length > 0;

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
  // Only a mapped column is a decision. The rest stay mappable — an unknown
  // header (a French or Arabic word, a school's own) must not become
  // unreachable — but behind one line, so a file with three real columns reads
  // as three decisions instead of six. The plan above is built from `matches`,
  // never from what this section draws.
  const matchedColumns = matches.filter((match) => match.field !== "ignore");
  const ignoredColumns = matches.filter((match) => match.field === "ignore");
  const matched = matchedColumns.length;

  /** The list a restore resolves its ids against — already in props, not re-read. */
  const studentsById = useMemo(
    () => new Map(students.map((student) => [student.id, student] as const)),
    [students],
  );

  /**
   * One child of the rollover preview, as `name · class`. A child with no name
   * prints his document id instead: he can never match a sheet row, so any
   * readable sheet archives him, and the id is then the only thing that names
   * him (R13). A missing class prints the unassigned token, so a line never
   * ends on a bare separator.
   */
  function childLine(id: string, name: string, grade: string): string {
    return `${name.trim() || id} · ${grade.trim() || t("import.unassignToken")}`;
  }

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

  /**
   * One sheet column and the dropdown that says where it goes. The same row is
   * drawn for a mapped column and for one behind the ignored line, so a header
   * the matcher did not know is corrected with the control it always had.
   */
  function mappingRow(match: ColumnMatch) {
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
  }

  async function handleApply() {
    if (!uid || writeCount === 0) return;
    setApplying(true);
    try {
      const moved = await applyAssignmentPlan(uid, writable);
      // `moved` counts every child the import touched, which includes the ones
      // it retired and restored. The imported figure is the half the sheet
      // actually moved or created — the archive toast reports the other half.
      const imported = writable.rows.length + writable.creates.length;
      // `moved` is 0 only when nothing was written (a school that could not be
      // resolved, say): toasting then would report a success that did not happen.
      if (moved > 0) {
        if (imported > 0) {
          showToast(tp("sheet.imported", imported, { count: digits(imported) }));
        }
        const archived = writable.archive.length;
        if (archived > 0) {
          showToast(tp("toast.archived", archived, { count: digits(archived) }));
        }
      }
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
            {matchedColumns.map(mappingRow)}
            {ignoredColumns.length > 0 && (
              <>
                <button
                  type="button"
                  aria-expanded={ignoredOpen}
                  aria-controls="sheet-ignored-columns"
                  onClick={() => setIgnoredOpen((open) => !open)}
                  className="press flex min-h-11 w-full items-center gap-2 py-2 text-start sm:min-h-9"
                >
                  <span className="min-w-0 flex-1 break-words text-[12.5px] leading-4 text-dash-on-surface-variant">
                    {tp("sheet.ignoredCount", ignoredColumns.length, {
                      count: digits(ignoredColumns.length),
                      names: nameList(
                        ignoredColumns.map(
                          (match) =>
                            match.header.trim() ||
                            t("sheet.columnLetter", { letter: columnLetter(match.index) }),
                        ),
                        localeCode(locale),
                        (rest) => t("sheet.moreNames", { count: digits(Number(rest)) }),
                      ),
                    })}
                  </span>
                  <span className="flex-none text-[12px] font-medium text-dash-on-surface-variant">
                    {t(ignoredOpen ? "sheet.hideIgnored" : "sheet.showIgnored")}
                  </span>
                  <Icon
                    name="expand_more"
                    size={18}
                    variant="outlined"
                    className={`flex-none text-dash-on-surface-variant transition-transform duration-[var(--t-ui)] ${
                      ignoredOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {ignoredOpen && (
                  <div id="sheet-ignored-columns" className="divide-y divide-dash-outline-variant">
                    {ignoredColumns.map(mappingRow)}
                  </div>
                )}
              </>
            )}
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

        {/* 3 — the classes this file will write. A new class is a decision, so
            it is called out here rather than discovered on Reports later. */}
        {plan.classes.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-dash-on-surface">
              {t("sheet.classesTitle")}
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {plan.classes.map((entry) => (
                <li
                  key={entry.label}
                  className="inline-flex items-center gap-1.5 rounded-[5px] border border-dash-outline-variant bg-dash-surface px-2 py-1 text-[12px] leading-4"
                >
                  <span className="font-medium text-dash-on-surface">
                    {translateDataLabel(entry.label, locale, t)}
                  </span>
                  <span className="tabular-nums text-dash-on-surface-variant">
                    {digits(entry.count)}
                  </span>
                  {entry.isNew && (
                    <span className="rounded-[4px] bg-dash-surface-container-high px-1.5 text-[10.5px] font-medium text-dash-on-surface-variant">
                      {t("sheet.classNew")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-[11.5px] leading-4 text-dash-on-surface-variant">
              {t("sheet.classesNote")}
            </p>
          </section>
        )}

        {/* The rollover, both directions: one sheet can archive the active twin
            and bring the archived one back in the same import, and printing
            both is the only thing that makes that visible before Apply (R11).
            Without the Students grant the dialog writes neither half, so the
            section is not drawn and `sheet.needsStudents` says why. */}
        {canWriteStudents && hasRollover && (
          <section className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="arc-field self-start"
              aria-pressed={archiveMissing}
              onClick={() => setArchiveMissing((current) => !current)}
            >
              {t("import.archiveToggle")}
            </Button>
            {!archiveMissing && (
              <p className="text-[12px] leading-5 text-dash-on-surface-variant">
                {t("import.archiveOff")}
              </p>
            )}
            {archiveMissing && plan.archive.length > 0 && (
              <div className="flex flex-col gap-1">
                <h3 className="text-[13px] font-semibold text-dash-on-surface">
                  {t("import.archiveTitle")}
                </h3>
                <p className="text-[12.5px] leading-5 text-dash-on-surface-variant">
                  {tp("import.archiveBody", plan.archive.length, {
                    count: digits(plan.archive.length),
                  })}
                </p>
                <ul className="flex flex-col text-[12px] leading-5 text-dash-on-surface">
                  {plan.archive.map((child) => (
                    <li key={child.id} className="break-words">
                      {childLine(child.id, child.name, child.grade)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {plan.restore.length > 0 && (
              <div className="flex flex-col gap-1">
                <h3 className="text-[13px] font-semibold text-dash-on-surface">
                  {t("import.restoreTitle")}
                </h3>
                <p className="text-[12.5px] leading-5 text-dash-on-surface-variant">
                  {tp("import.restoreBody", plan.restore.length, {
                    count: digits(plan.restore.length),
                  })}
                </p>
                <ul className="flex flex-col text-[12px] leading-5 text-dash-on-surface">
                  {plan.restore.map((id) => {
                    const student = studentsById.get(id);
                    return (
                      <li key={id} className="break-words">
                        {student ? childLine(student.id, student.name, student.grade) : id}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* 4 — the result, spoken as a sentence rather than drawn. The
            separator trails its own statement, so a wrapped line never starts
            with a lone dot. */}
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-lg border border-dash-outline-variant bg-dash-surface-container-low px-3 py-2.5 text-[12.5px] leading-5 tabular-nums text-dash-on-surface-variant">
          {(
            [
              { key: "sheet.resultNew", count: writable.creates.length },
              { key: "sheet.resultUpdate", count: writable.rows.length },
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

        {/* 4 — the two lists that make this a review rather than a promise: the
            children the file would create, and the rows it would leave alone.
            A mistyped name shows up here as a second child. */}
        {(plan.creates.length > 0 || plan.unmatched.length > 0) && (
          <div className="-mt-2 flex flex-col gap-1.5 text-[12px] leading-5">
            {plan.creates.length > 0 && (
              <p className="text-dash-on-surface-variant">
                <span className="font-medium text-dash-on-surface">
                  {t("sheet.newChildrenLabel")}
                </span>{" "}
                {nameList(
                  plan.creates.map((create) => create.name),
                  localeCode(locale),
                  (rest) => t("sheet.moreNames", { count: digits(Number(rest)) }),
                )}
              </p>
            )}
            {plan.unmatched.length > 0 && (
              <p className="text-dash-on-surface-variant">
                <span className="font-medium text-dash-on-surface">
                  {t("sheet.notAppliedLabel")}
                </span>{" "}
                {nameList(plan.unmatched, localeCode(locale), (rest) =>
                  t("sheet.moreNames", { count: digits(Number(rest)) }),
                )}
              </p>
            )}
          </div>
        )}

        {blocked && (
          <p
            role="status"
            className="flex items-start gap-1.5 text-[12px] leading-5 text-dash-error"
          >
            <Icon name="info" size={15} variant="outlined" className="mt-px flex-none" />
            {t("sheet.needsStudents")}
          </p>
        )}
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
            disabled={writeCount === 0}
            loading={applying}
          >
            {t("sheet.apply", { count: digits(writeCount) })}
          </Button>
        </div>
      </footer>
    </>
  );
}

export default SheetImportDialog;
