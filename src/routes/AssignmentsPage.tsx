import { useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import {
  assignDriverToBus,
  assignStudentToBus,
  useBuses,
  useBusStudentCounts,
  useStaffUsers,
  useStudentsPaginated,
  type AdminStudent,
} from "@/lib/school-admin";
import { AssignmentsSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { PaginationBar } from "@/components/dashboard/PaginationBar";
import { useAutoLoadMore, usePageSlice } from "@/lib/use-page-slice";
import { ExpandingSearch } from "@/components/arc/expanding-search/expanding-search";
import { Icon } from "@/components/Icon";
import { staggerStyle } from "@/lib/motion";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

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
  const students = useStudentsPaginated();
  // Bump after a student write so the per-bus counts refresh.
  const [studentsVersion, setStudentsVersion] = useState(0);
  const counts = useBusStudentCounts(buses, studentsVersion);

  const digits = (n: number) => toLocaleDigits(String(n), locale);

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
    try {
      await assignStudentToBus(uid, student.id, value || null);
      setStudentsVersion((v) => v + 1);
      showToast(t("assignments.studentMoved"));
    } catch {
      showToast(t("toast.error"));
    }
  }

  const filteredStudents = useMemo(() => {
    const q = students.search.trim().toLowerCase();
    if (!q) return students.students;
    return students.students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students.students, students.search]);
  // The rows are a cursor page, not the whole collection: page what is loaded
  // and fetch the next page when the reader reaches the end of it.
  const studentPage = usePageSlice(filteredStudents, 10, students.search);
  useAutoLoadMore(studentPage, students);

  return (
    <>
      <div className="px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-dash-headline-lg text-dash-on-surface">{t("assignments.title")}</h1>
            <p className="text-[13px] text-dash-on-surface-variant">{t("assignments.subtitle")}</p>
          </div>
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
                      <table className="w-full min-w-[560px] border-collapse text-start">
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
            <section className="flex flex-col gap-4">
              {sectionTitle(
                <Icon name="school" size={18} variant="outlined" className="flex-none" />,
                t("assignments.students"),
              )}
              <div className="w-full sm:w-64">
                <ExpandingSearch
                  anchor="start"
                  label={t("studentList.searchAria")}
                  placeholder={t("studentList.searchPlaceholder")}
                  clearLabel={t("mobile.clearSearchAria")}
                  value={students.search}
                  onValueChange={students.setSearch}
                />
              </div>

              {students.loading && students.students.length === 0 ? (
                <div role="status" className="flex items-center gap-2 py-8 text-[13px] text-dash-on-surface-variant">
                  <Icon name="progress_activity" size={16} variant="outlined" className="animate-spin" />
                  {t("assignments.loadingStudents")}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dash-outline-variant bg-dash-surface px-4 py-10 text-center">
                  <Icon name="search_off" size={32} variant="outlined" className="text-dash-on-surface-variant" />
                  <p className="text-[13px] text-dash-on-surface-variant">{t("assignments.studentsEmpty")}</p>
                  {students.search && (
                    <p className="text-[13px] text-dash-on-surface-variant">{t("assignments.studentsEmptyHint")}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
                    {/* Phone: one card per student. */}
                    <ul className="divide-y divide-dash-outline-variant md:hidden">
                      {studentPage.paged.map((student, index) => {
                        const assignedBus = buses.find((b) => b.id === student.busId);
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
                            ariaLabel={`${t("assignments.th.currentBus")} — ${student.name}`}
                            label={assignedBus ? translateDataLabel(assignedBus.name, locale, t) : t("assignments.noBus")}
                            align="start"
                            matchTriggerWidth
                            triggerClassName="arc-field mt-2 w-full"
                            items={[
                              {
                                label: t("assignments.noBus"),
                                checked: !student.busId,
                                onSelect: () => handleStudentBusChange(student, ""),
                              },
                              ...buses.map((bus) => ({
                                label: translateDataLabel(bus.name, locale, t),
                                checked: bus.id === student.busId,
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
                      <table className="w-full min-w-[560px] border-collapse text-start">
                        <thead className="border-b border-dash-outline-variant text-[11.5px] text-dash-on-surface-variant">
                          <tr>
                            <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.studentName")}</th>
                            <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.grade")}</th>
                            <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.currentBus")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dash-outline-variant text-dash-body-sm text-dash-on-surface">
                          {studentPage.paged.map((student) => {
                            const assignedBus = buses.find((b) => b.id === student.busId);
                            return (
                            <tr key={student.id} className="hover:bg-dash-surface-container-low">
                              <td className="px-4 py-3 font-medium">{student.name}</td>
                              <td className="px-4 py-3">{translateDataLabel(student.grade, locale, t)}</td>
                              <td className="px-4 py-3">
                                <DropdownMenu
                                  ariaLabel={`${t("assignments.th.currentBus")} — ${student.name}`}
                                  label={assignedBus ? translateDataLabel(assignedBus.name, locale, t) : t("assignments.noBus")}
                                  align="start"
                                  triggerClassName="arc-field"
                                  items={[
                                    {
                                      label: t("assignments.noBus"),
                                      checked: !student.busId,
                                      onSelect: () => handleStudentBusChange(student, ""),
                                    },
                                    ...buses.map((bus) => ({
                                      label: translateDataLabel(bus.name, locale, t),
                                      checked: bus.id === student.busId,
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
    </>
  );
}
