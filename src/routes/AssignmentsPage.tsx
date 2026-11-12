import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import {
  assignDriverToBus,
  assignStudentToBus,
  useBuses,
  useBusStudentCounts,
  useStaffUsers,
  useStudentsPaginated,
  fetchAllStudents,
  type AdminBus,
  type AdminStudent,
} from "@/lib/school-admin";
import { useAssignmentMode } from "@/lib/school";
import { SlideSegments } from "@/components/SlideSegments";
import { AssignmentsSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { Button } from "@/components/arc/button/button";
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone";
import { SheetImportDialog } from "@/components/import/SheetImportDialog";
import { PaginationBar } from "@/components/dashboard/PaginationBar";
import { useAutoLoadMore, usePageSlice } from "@/lib/use-page-slice";
import { ExpandingSearch } from "@/components/arc/expanding-search/expanding-search";
import { downloadCsv } from "@/lib/csv";
import { parseSheetFile, type ParsedSheet } from "@/lib/sheet-import";
import { Icon } from "@/components/Icon";
import { staggerStyle } from "@/lib/motion";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

/**
 * The bus a row shows: the write's own answer while we hold one, else the
 * document. One definition, because the row, its `checked` flags and the bus
 * filter must all agree — a filter that read the stored value would hide the row
 * the director just moved.
 */
function busIdOf(
  student: AdminStudent,
  overrides: Record<string, string | null>,
): string | null {
  return student.id in overrides ? overrides[student.id] : student.busId;
}

/**
 * Director-only Assignments page (the dashboard layout enforces the role):
 * two sections — a Drivers section (link a staff user to each bus, one driver
 * per bus) and a paginated Students section (move students between buses).
 * Writes go straight to Firestore; both sections update in realtime.
 *
 * The tables are the md+ composition. Below md each row becomes a card: the
 * identity reads as two lines, and the control is full-width and 44px tall so
 * a thumb can hit it without pinching.
 */
export default function AssignmentsPage() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const uid = user?.uid;
  const { showToast } = useToast();

  const { buses, loading: busesLoading } = useBuses();
  const { staff } = useStaffUsers();

  /**
   * Two refresh signals, deliberately separate.
   *
   * `countsVersion` refreshes the per-bus totals after a write — a count query
   * has no document to race, so it is safe (and cheap) to re-ask immediately.
   * `listVersion` re-reads the cursor page, and only the importer bumps it: the
   * rows really did change in bulk, and the re-read is then the source of truth.
   * A single move must never re-read, because an immediate `getDocs` can return
   * the pre-write document and the row would visibly snap back.
   */
  const [countsVersion, setCountsVersion] = useState(0);
  const [listVersion, setListVersion] = useState(0);
  const students = useStudentsPaginated(listVersion);
  const counts = useBusStudentCounts(buses, countsVersion);

  /**
   * Whether a row is labelled by bus or by driver. One value on the school
   * document, so every colleague reads the same column — some schools think in
   * bus numbers, others in the person driving it.
   */
  const { mode: assignMode, setMode: setAssignMode } = useAssignmentMode();

  /**
   * The write's answer, keyed by student id: the row shows the new bus before
   * the write lands and keeps showing it until a list re-read replaces the rows.
   * `null` is a real value here ("no bus"), so presence of the key — never the
   * value — decides whether the override applies.
   */
  const [busOverrides, setBusOverrides] = useState<Record<string, string | null>>({});

  /**
   * The Students section's filters. `null` is "no filter"; "no bus" is a bus a
   * row can hold, so it cannot double as the reset value.
   */
  const [busFilter, setBusFilter] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);

  // Sheet import: the parsed file is stashed so closing the mapping dialog
  // does not force the director to choose the file again. The token drops a
  // parse whose file was removed before it finished.
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  /**
   * The whole roll, fetched when a sheet is read. The table's own list is one
   * cursor page (50), and a sheet matched against only those rows would report
   * every child past them as "no student" and silently skip the move.
   */
  const [importStudents, setImportStudents] = useState<AdminStudent[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [parseFailed, setParseFailed] = useState(false);
  /**
   * The drop zone is a disclosure, closed by default: importing is a
   * once-a-term job, and a permanent panel would push the roster (the thing the
   * page is actually for) below the fold. It is also capped at the drop
   * target's width — see the card below — so it never reads as a page-wide
   * control either.
   */
  const [dropOpen, setDropOpen] = useState(false);
  const parseToken = useRef(0);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const digits = (n: number) => toLocaleDigits(String(n), locale);

  /** The importer reads the whole file into memory, so the cap is real. */
  const MAX_SHEET_BYTES = 10 * 1024 * 1024;

  async function handleSheetFiles(files: File[]) {
    const token = ++parseToken.current;
    const file = files[0];
    if (!file) {
      // Removing the row in the drop zone withdraws the stashed sheet with it.
      setSheet(null);
      setParseFailed(false);
      return;
    }
    if (file.size > MAX_SHEET_BYTES) {
      setSheet(null);
      setParseFailed(true);
      setDropOpen(true);
      showToast(t("sheet.unreadable"));
      return;
    }
    setParseFailed(false);
    try {
      const parsed = await parseSheetFile(file);
      if (token !== parseToken.current) return;
      setSheet(parsed);
      // The sheet is read: fold the target away and let the summary row carry
      // the file. The mapping dialog opens over it.
      setDropOpen(false);
      setImportOpen(true);
      if (uid) {
        void fetchAllStudents(uid)
          .then((all) => {
            if (token === parseToken.current) setImportStudents(all);
          })
          .catch(() => setImportStudents(null));
      }
    } catch {
      if (token !== parseToken.current) return;
      setSheet(null);
      setParseFailed(true);
      setDropOpen(true);
      showToast(t("sheet.unreadable"));
    }
  }

  function handleDownloadTemplate() {
    // The header line is the machine contract the importer matches on, so it
    // stays in its canonical spelling in both languages; only the sample row
    // carries data. Quoted cells keep a comma inside a name from splitting it.
    // The download itself goes through the app's existing Blob helper.
    const sample = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const sampleBus = buses[0]?.name ?? "Bus 01";
    downloadCsv(
      "assignments-template.csv",
      `\uFEFFStudent name,Grade,Bus\r\n${sample("Ada Lovelace")},${sample("Grade 6")},${sample(sampleBus)}`,
    );
  }

  // The dialog maps a parsed sheet, so with nothing read yet the drop zone is
  // the way in: focusing its trigger scrolls it into view and lands the
  // keyboard on the file picker, instead of opening an empty panel.
  function handleImport() {
    if (sheet) {
      setImportOpen(true);
      return;
    }
    setDropOpen(true);
    // The panel is not in the DOM until it opens, so focus lands next frame.
    requestAnimationFrame(() => {
      dropZoneRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    });
  }

  const sectionTitle = (icon: ReactNode, label: string) => (
    <h2 className="flex items-center gap-2 text-[15px] font-semibold text-dash-on-surface">
      {icon}
      {label}
    </h2>
  );

  async function handleDriverChange(busId: string, value: string) {
    if (!uid) return;
    const driver = staff.find((s) => s.uid === value);
    if (value !== "" && !driver) return;
    // Where is this driver assigned right now? Clearing a bus unassigns it from
    // itself; assigning a driver also frees their previous bus in the same batch.
    const prevBusId = value
      ? (buses.find((b) => b.driverUid === value)?.id ?? null)
      : busId;
    try {
      await assignDriverToBus(uid, busId, value || null, driver?.displayName ?? "", prevBusId);
      showToast(value ? t("assignments.driverAssigned") : t("assignments.driverCleared"));
    } catch {
      showToast(t("toast.error"));
    }
  }

  async function handleStudentBusChange(student: AdminStudent, value: string) {
    if (!uid) return;
    const nextBusId = value || null;
    // Optimistic *before* the await: the trigger and its check mark read this
    // map, so the row flips at once instead of showing the old bus until the
    // next read.
    setBusOverrides((prev) => ({ ...prev, [student.id]: nextBusId }));
    try {
      await assignStudentToBus(uid, student.id, nextBusId);
      // The document now holds this value; the override stands in for it until
      // the next list re-read, and the counts are the one thing to re-ask.
      setCountsVersion((v) => v + 1);
      showToast(t("assignments.studentMoved"));
    } catch {
      // The write failed, so withdraw the row's answer: the stored bus is true
      // again, and the director is told rather than left with a silent revert.
      setBusOverrides((prev) => {
        const next = { ...prev };
        delete next[student.id];
        return next;
      });
      showToast(t("toast.error"));
    }
  }

  /**
   * How one bus reads in the current mode. Driver mode names the person, and
   * keeps a bus with no driver selectable ("Bus 07 · no driver") — hiding it
   * would make those children impossible to move.
   */
  const busLabel = useCallback(
    (bus: AdminBus) => {
      const name = translateDataLabel(bus.name, locale, t);
      if (assignMode === "bus") return name;
      const driver = staff.find((s) => s.uid === bus.driverUid);
      return driver
        ? driver.displayName
        : t("assignments.busWithoutDriver", { bus: name });
    },
    [assignMode, staff, locale, t],
  );

  /** The label for a stored bus id — the one place the two modes meet. */
  const busLabelFor = useCallback(
    (busId: string | null) => {
      if (!busId) return t("assignments.noBus");
      const bus = buses.find((b) => b.id === busId);
      return bus ? busLabel(bus) : busId;
    },
    [buses, busLabel, t],
  );

  /** True when the search or either filter is narrowing the list. */
  const filtering =
    students.search.trim() !== "" || busFilter !== null || gradeFilter !== null;

  function clearStudentFilters() {
    students.setSearch("");
    setBusFilter(null);
    setGradeFilter(null);
  }

  const filteredStudents = useMemo(() => {
    const q = students.search.trim().toLowerCase();
    if (!q && busFilter === null && gradeFilter === null) {
      return students.students;
    }
    return students.students.filter(
      (student) =>
        (q === "" || student.name.toLowerCase().includes(q)) &&
        // The filter reads the same bus the row shows (see `busIdOf`).
        (busFilter === null || busIdOf(student, busOverrides) === busFilter) &&
        (gradeFilter === null || student.grade === gradeFilter),
    );
  }, [students.students, students.search, busFilter, gradeFilter, busOverrides]);

  /**
   * Filter options come from the rows, not from the buses or the roll: a bus
   * with nobody assigned could only ever produce an empty list. Sorted by the
   * stored label so the order does not change with the language.
   */
  const busOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const student of students.students) {
      const busId = busIdOf(student, busOverrides);
      if (busId) ids.add(busId);
    }
    // Sorted by what the reader sees, so driver mode reads as a list of names
    // rather than a list of buses wearing names.
    return [...ids]
      .map((id) => ({ id, label: busLabelFor(id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [students.students, busOverrides, busLabelFor]);

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>();
    for (const student of students.students) {
      if (student.grade) grades.add(student.grade);
    }
    return [...grades].sort((a, b) => a.localeCompare(b));
  }, [students.students]);

  /**
   * A data-driven selector grows a search field from four options up — at that
   * length the menu is scanned rather than read — and stays a plain menu below
   * it, where a field would be noise. The reset row never counts.
   */
  const searchable = (count: number) =>
    count >= 4
      ? {
          placeholder: t("dropdown.searchPlaceholder"),
          emptyLabel: t("dropdown.searchEmpty"),
        }
      : undefined;

  const selectedBusName = busFilter
    ? busLabelFor(busFilter)
    : t("assignments.allBuses");

  /** The column's name in the current mode — one string, three places. */
  const busColumnLabel = t(
    assignMode === "driver"
      ? "assignments.th.currentDriver"
      : "assignments.th.currentBus",
  );

  // The rows are a cursor page, not the whole collection: page what is loaded
  // and fetch the next page when the reader reaches the end of it. The reset key
  // carries the search AND both filters — narrowing is a new question, so a
  // reader on page 3 must land on page 1 — while new rows alone only clamp.
  const studentPage = usePageSlice(
    filteredStudents,
    10,
    `${students.search}|${busFilter ?? ""}|${gradeFilter ?? ""}`,
  );
  useAutoLoadMore(studentPage, students);

  return (
    <>
      <div className="px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="mx-auto w-full max-w-[1440px]">
          <PageHeader
            title={t("assignments.title")}
            subtitle={t("assignments.subtitle")}
            actions={
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="arc-field"
                  onClick={handleDownloadTemplate}
                >
                  <Icon name="download" size={16} variant="outlined" />
                  {t("sheet.template")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleImport}
                >
                  <Icon name="description" size={16} variant="outlined" />
                  {t("sheet.import")}
                </Button>
              </>
            }
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 sm:p-6">
        {busesLoading ? (
          <div role="status" aria-label={t("dashboard.loading")}>
            <AssignmentsSkeleton />
          </div>
        ) : (
          <>
            {/* Drivers — one card per bus on a phone, one row per bus on desktop */}
            <section className="flex flex-col gap-4">
              {sectionTitle(
                <Icon name="directions_bus" size={18} variant="outlined" className="flex-none" />,
                t("assignments.drivers"),
              )}
              <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
                {buses.length === 0 ? (
                  <p className="px-4 py-6 text-[13px] leading-5 text-dash-on-surface-variant">
                    {t("assignments.busesEmpty")}
                  </p>
                ) : (
                  <>
                    <ul className="divide-y divide-dash-outline-variant md:hidden">
                      {buses.map((bus, index) => {
                        const busName = translateDataLabel(bus.name, locale, t);
                        const driver = staff.find((s) => s.uid === bus.driverUid);
                        return (
                          <li
                            key={bus.id}
                            className="stagger-in px-4 py-3.5"
                            style={staggerStyle(index, buses.length)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="min-w-0 break-words text-[13.5px] font-medium leading-5 text-dash-on-surface">
                                {busName}
                              </p>
                              <div className="flex-none text-end">
                                <p className="text-[14px] font-semibold leading-5 tabular-nums text-dash-on-surface">
                                  {digits(counts[bus.id] ?? 0)}
                                </p>
                                <p className="text-[11px] leading-4 text-dash-on-surface-variant">
                                  {t("assignments.th.assignedStudents")}
                                </p>
                              </div>
                            </div>
                            <p className="mt-0.5 break-words text-[12px] leading-4 text-dash-on-surface-variant">
                              {driver ? driver.displayName : t("dashboard.noDriver")}
                            </p>
                            <DropdownMenu
                              ariaLabel={`${t("assignments.th.driver")} — ${busName}`}
                              label={driver ? driver.displayName : t("assignments.unassigned")}
                              align="start"
                              matchTriggerWidth
                              triggerClassName="arc-field mt-2 w-full"
                              searchable={searchable(staff.length)}
                              items={[
                                {
                                  label: t("assignments.unassigned"),
                                  checked: !bus.driverUid,
                                  onSelect: () => handleDriverChange(bus.id, ""),
                                },
                                ...staff.map((s) => ({
                                  label: s.displayName,
                                  checked: s.uid === bus.driverUid,
                                  onSelect: () => handleDriverChange(bus.id, s.uid),
                                })),
                              ]}
                            />
                          </li>
                        );
                      })}
                    </ul>

                    <div className="hidden overflow-x-auto md:block">
                      <table className="table-zebra w-full min-w-[560px] border-collapse text-start">
                        <thead className="border-b border-dash-outline-variant text-[11.5px] text-dash-on-surface-variant">
                          <tr>
                            <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.bus")}</th>
                            <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.driver")}</th>
                            <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.assignedStudents")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dash-outline-variant text-dash-body-sm text-dash-on-surface">
                          {buses.map((bus) => {
                            const driver = staff.find((s) => s.uid === bus.driverUid);
                            return (
                            <tr key={bus.id} className="hover:bg-dash-surface-container-low">
                              <td className="px-4 py-3 font-medium">
                                {translateDataLabel(bus.name, locale, t)}
                              </td>
                              <td className="px-4 py-3">
                                <DropdownMenu
                                  ariaLabel={`${t("assignments.th.driver")} — ${translateDataLabel(bus.name, locale, t)}`}
                                  label={driver ? driver.displayName : t("assignments.unassigned")}
                                  align="start"
                                  triggerClassName="arc-field"
                                  searchable={searchable(staff.length)}
                                  items={[
                                    {
                                      label: t("assignments.unassigned"),
                                      checked: !bus.driverUid,
                                      onSelect: () => handleDriverChange(bus.id, ""),
                                    },
                                    ...staff.map((s) => ({
                                      label: s.displayName,
                                      checked: s.uid === bus.driverUid,
                                      onSelect: () => handleDriverChange(bus.id, s.uid),
                                    })),
                                  ]}
                                />
                              </td>
                              <td className="px-4 py-3 tabular-nums">
                                {digits(counts[bus.id] ?? 0)}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Students — paginated list with a per-row bus select */}
            <section data-tour="assignments-students" className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {sectionTitle(
                  <Icon name="school" size={18} variant="outlined" className="flex-none" />,
                  t("assignments.students"),
                )}
                {/* What a row is labelled with: the bus it rides, or the person
                    driving it. The choice is the school's (one field on the
                    school document), so every colleague reads the same column.
                    A director, or an operator granted Assignments, may flip it;
                    the rules refuse the write from anyone else. */}
                <div className="w-full sm:w-60 sm:flex-none">
                  <SlideSegments
                    variant="dash-box"
                    ariaLabel={t("assignments.modeAria")}
                    options={[
                      { id: "bus" as const, label: t("assignments.byBus") },
                      { id: "driver" as const, label: t("assignments.byDriver") },
                    ]}
                    value={assignMode}
                    onChange={(next) => {
                      void setAssignMode(next).catch(() => showToast(t("toast.error")));
                    }}
                  />
                </div>
              </div>

              {/* The new way in: the school's own class list. Parsing is a
                  read — the mapping dialog decides what, if anything, is
                  written. */}
              <div
                data-tour="assignments-import"
                className="max-w-xl rounded-lg border border-dash-outline-variant bg-dash-surface"
              >
                {/* A disclosure, not a permanent panel: importing is a
                    once-a-term job, and a panel as wide as the page reads as a
                    page-wide control with the roster — the screen's actual job
                    — pushed below it. The cap sits here, on the disclosure
                    root, so the summary row and the panel share one width
                    instead of the open state painting a long empty band with a
                    small dashed box at its start. The summary keeps the chosen
                    file's name visible while the disclosure is closed. */}
                <div className="flex items-center gap-2 px-2.5 py-1.5">
                  <button
                    type="button"
                    aria-expanded={dropOpen}
                    aria-controls="sheet-import-panel"
                    onClick={() => setDropOpen((open) => !open)}
                    className="press flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5 text-start"
                  >
                    <Icon
                      name="description"
                      size={17}
                      variant="outlined"
                      className="flex-none text-dash-on-surface-variant"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-dash-on-surface">
                        {t("sheet.import")}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-dash-on-surface-variant">
                        {sheet && (
                          <span
                            className="h-1.5 w-1.5 flex-none rounded-full bg-dash-success"
                            aria-hidden="true"
                          />
                        )}
                        <span className="truncate">
                          {sheet ? sheet.fileName : t("sheet.dropTitle")}
                        </span>
                      </span>
                    </span>
                    <Icon
                      name="expand_more"
                      size={20}
                      variant="outlined"
                      className={`ms-auto flex-none text-dash-on-surface-variant transition-transform duration-[var(--t-ui)] ${
                        dropOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {sheet && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="arc-field flex-none"
                      onClick={handleImport}
                    >
                      {t("sheet.matchColumns")}
                    </Button>
                  )}
                </div>

                {dropOpen && (
                  <div
                    id="sheet-import-panel"
                    ref={dropZoneRef}
                    className="border-t border-dash-outline-variant p-3"
                  >
                    {/* The body simply fills the card: the width cap lives on
                        the disclosure root, so opening it cannot be wider than
                        the summary row above it. */}
                    <div className="w-full">
                      <FileDropzone
                        accept=".csv,.xlsx,.xls"
                        multiple={false}
                        maxFiles={1}
                        label={t("sheet.dropTitle")}
                        dropLabel={t("sheet.dropTitle")}
                        description={t("sheet.dropDesc")}
                        note={t("sheet.dropNote")}
                        labels={{
                          files: t("sheet.dz.files"),
                          remove: t("sheet.dz.remove"),
                          retry: t("sheet.dz.retry"),
                          uploading: t("sheet.dz.uploading"),
                          uploaded: t("sheet.dz.uploaded"),
                          uploadFailed: t("sheet.dz.uploadFailed"),
                          failed: t("sheet.dz.failed"),
                          wrongTypeOne: t("sheet.dz.wrongTypeOne"),
                          wrongTypeMany: t("sheet.dz.wrongTypeMany"),
                          tooMany: t("sheet.dz.tooMany"),
                          dropOne: t("sheet.dz.dropOne"),
                          dropMany: t("sheet.dz.dropMany"),
                        }}
                        onFilesChange={handleSheetFiles}
                      />
                      {parseFailed && (
                        <p
                          role="alert"
                          className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-4 text-dash-error"
                        >
                          <Icon name="info" size={15} variant="outlined" className="mt-px flex-none" />
                          {t("sheet.unreadable")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Search plus the two value selectors: one row from md, stacked
                  on a phone, each control keeping the app's 3:1 field edge. */}
              <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
                <div className="w-full md:w-64 md:flex-none">
                  <ExpandingSearch
                    anchor="start"
                    label={t("studentList.searchAria")}
                    placeholder={t("studentList.searchPlaceholder")}
                    clearLabel={t("mobile.clearSearchAria")}
                    value={students.search}
                    onValueChange={students.setSearch}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu
                    ariaLabel={
                      assignMode === "driver"
                        ? t("assignments.filterDriverAria")
                        : t("assignments.filterBusAria")
                    }
                    label={selectedBusName}
                    align="start"
                    triggerClassName="arc-field"
                    searchable={searchable(busOptions.length)}
                    items={[
                      {
                        label: t("assignments.allBuses"),
                        checked: busFilter === null,
                        onSelect: () => setBusFilter(null),
                      },
                      ...busOptions.map((option) => ({
                        label: option.label,
                        checked: busFilter === option.id,
                        onSelect: () => setBusFilter(option.id),
                      })),
                    ]}
                  />

                  <DropdownMenu
                    ariaLabel={t("assignments.filterGradeAria")}
                    label={
                      gradeFilter
                        ? translateDataLabel(gradeFilter, locale, t)
                        : t("studentList.allGrades")
                    }
                    align="start"
                    triggerClassName="arc-field"
                    searchable={searchable(gradeOptions.length)}
                    items={[
                      {
                        label: t("studentList.allGrades"),
                        checked: gradeFilter === null,
                        onSelect: () => setGradeFilter(null),
                      },
                      ...gradeOptions.map((grade) => ({
                        label: translateDataLabel(grade, locale, t),
                        checked: gradeFilter === grade,
                        onSelect: () => setGradeFilter(grade),
                      })),
                    ]}
                  />

                  {filtering && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      className="arc-field"
                      onClick={clearStudentFilters}
                    >
                      <Icon name="filter_alt_off" size={16} variant="outlined" />
                      {t("studentList.clear")}
                    </Button>
                  )}
                </div>

                {/* Quiet, and only while it means something: the loaded page is
                    what the filters narrow, so the total is the rows in hand. */}
                {filtering && (
                  <p className="text-[11.5px] leading-4 text-dash-on-surface-variant md:ms-auto">
                    {t("assignments.filteredCount", {
                      shown: digits(filteredStudents.length),
                      total: digits(students.students.length),
                    })}
                  </p>
                )}
              </div>

              {students.loading && students.students.length === 0 ? (
                <div role="status" className="flex items-center gap-2 py-8 text-[13px] text-dash-on-surface-variant">
                  <Icon name="progress_activity" size={16} variant="outlined" className="animate-spin" />
                  {t("assignments.loadingStudents")}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dash-outline-variant bg-dash-surface px-4 py-10 text-center">
                  <Icon name="search_off" size={32} variant="outlined" className="text-dash-on-surface-variant" />
                  {/* Two causes, two answers: a filter that matched nobody is
                      not a school without students. */}
                  <p className="text-[13px] text-dash-on-surface-variant">
                    {t(filtering ? "assignments.filterEmpty" : "assignments.studentsEmpty")}
                  </p>
                  <p className="text-[13px] text-dash-on-surface-variant">
                    {t(
                      filtering
                        ? "assignments.filterEmptyHint"
                        : "assignments.studentsEmptyHint",
                    )}
                  </p>
                  {filtering && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      className="arc-field mt-1"
                      onClick={clearStudentFilters}
                    >
                      <Icon name="filter_alt_off" size={16} variant="outlined" />
                      {t("studentList.clear")}
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
                    {/* Phone: one card per student. */}
                    <ul className="divide-y divide-dash-outline-variant md:hidden">
                      {studentPage.paged.map((student, index) => {
                        // The bus on screen, not the bus in the document: a
                        // just-moved row must show its new bus (and tick it)
                        // before the list is ever re-read.
                        const effectiveBusId = busIdOf(student, busOverrides);
                        return (
                        <li
                          key={student.id}
                          className="stagger-in px-4 py-3.5"
                          style={staggerStyle(index, studentPage.paged.length)}
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="min-w-0 break-words text-[13.5px] font-medium leading-5 text-dash-on-surface">
                              {student.name}
                            </p>
                            <p className="flex-none whitespace-nowrap text-[11.5px] leading-5 text-dash-on-surface-variant">
                              {translateDataLabel(student.grade, locale, t)}
                            </p>
                          </div>
                          <DropdownMenu
                            ariaLabel={`${busColumnLabel} — ${student.name}`}
                            label={busLabelFor(effectiveBusId)}
                            align="start"
                            matchTriggerWidth
                            triggerClassName="arc-field mt-2 w-full"
                            searchable={searchable(buses.length)}
                            items={[
                              {
                                label: t("assignments.noBus"),
                                checked: !effectiveBusId,
                                onSelect: () => handleStudentBusChange(student, ""),
                              },
                              ...buses.map((bus) => ({
                                label: busLabel(bus),
                                checked: bus.id === effectiveBusId,
                                onSelect: () => handleStudentBusChange(student, bus.id),
                              })),
                            ]}
                          />
                        </li>
                        );
                      })}
                    </ul>

                    {/* Tablet / desktop: the table. */}
                    <div className="hidden overflow-x-auto md:block">
                      <table className="table-zebra w-full min-w-[560px] border-collapse text-start">
                        <thead className="border-b border-dash-outline-variant text-[11.5px] text-dash-on-surface-variant">
                          <tr>
                            <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.studentName")}</th>
                            <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.grade")}</th>
                            <th scope="col" className="h-10 px-4 py-2 font-medium">
                              {busColumnLabel}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dash-outline-variant text-dash-body-sm text-dash-on-surface">
                          {studentPage.paged.map((student) => {
                            const effectiveBusId = busIdOf(student, busOverrides);
                            return (
                            <tr key={student.id} className="hover:bg-dash-surface-container-low">
                              <td className="px-4 py-3 font-medium">{student.name}</td>
                              <td className="px-4 py-3">{translateDataLabel(student.grade, locale, t)}</td>
                              <td className="px-4 py-3">
                                <DropdownMenu
                                  ariaLabel={`${busColumnLabel} — ${student.name}`}
                                  label={busLabelFor(effectiveBusId)}
                                  align="start"
                                  triggerClassName="arc-field"
                                  searchable={searchable(buses.length)}
                                  items={[
                                    {
                                      label: t("assignments.noBus"),
                                      checked: !effectiveBusId,
                                      onSelect: () => handleStudentBusChange(student, ""),
                                    },
                                    ...buses.map((bus) => ({
                                      label: busLabel(bus),
                                      checked: bus.id === effectiveBusId,
                                      onSelect: () => handleStudentBusChange(student, bus.id),
                                    })),
                                  ]}
                                />
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                </div>
                {studentPage.totalPages > 1 && (
                  <PaginationBar pagination={studentPage} />
                )}
              </>
            )}
            </section>
          </>
        )}
      </div>

      {/* The import's second step. Students and buses are the page's own
          queries — the dialog never re-reads them. */}
      <SheetImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        sheet={sheet}
        students={importStudents ?? students.students}
        buses={buses}
        onApplied={() => {
          // The import rewrote the documents in bulk, so the loaded page is
          // stale: re-read it, and hand the bus answers back to the documents
          // that just replaced them.
          setListVersion((v) => v + 1);
          setBusOverrides({});
          setCountsVersion((v) => v + 1);
        }}
      />
    </>
  );
}
