import { useMemo, useState } from "react";
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
import { Icon } from "@/components/Icon";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

/**
 * Director-only Assignments page (the dashboard layout enforces the role):
 * two sections — a Drivers table (link a staff user to each bus, one driver per
 * bus) and a paginated Students table (move students between buses). Writes go
 * straight to Firestore; the tables update in realtime.
 */
export default function AssignmentsPage() {
  const { t, locale, dir } = useLocale();
  const ltr = dir === "ltr";
  const { user } = useAuth();
  const uid = user?.uid;
  const { showToast } = useToast();

  const { buses, loading: busesLoading } = useBuses();
  const staff = useStaffUsers();
  const students = useStudentsPaginated();
  // Bump after a student write so the per-bus counts refresh.
  const [studentsVersion, setStudentsVersion] = useState(0);
  const counts = useBusStudentCounts(buses, studentsVersion);

  const sectionTitle = (icon: string, label: string) => (
    <h2
      className={`flex items-center gap-2 border-b border-dash-outline-variant pb-2 text-dash-label-md uppercase text-dash-on-surface ${
        ltr ? "tracking-widest" : ""
      }`}
    >
      <Icon name={icon} size={18} variant="outlined" />
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

  return (
    <>
      <div className="border-b border-dash-outline-variant bg-dash-surface-container-low px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-dash-headline-lg text-dash-on-surface">{t("assignments.title")}</h1>
            <p className="text-dash-body-sm text-dash-on-surface-variant">{t("assignments.subtitle")}</p>
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
            {/* Drivers — one row per bus */}
            <section className="flex flex-col gap-4">
              {sectionTitle("directions_bus", t("assignments.drivers"))}
              <div className="overflow-x-auto rounded border border-dash-outline-variant bg-dash-surface">
                <table className="w-full min-w-[560px] border-collapse text-start">
                  <thead className="border-b border-dash-outline-variant bg-dash-surface-container text-dash-label-md uppercase text-dash-on-surface-variant">
                    <tr>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.bus")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.driver")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.assignedStudents")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dash-outline-variant text-dash-body-sm text-dash-on-surface">
                    {buses.map((bus) => (
                      <tr key={bus.id} className="hover:bg-dash-surface-container-low">
                        <td className="px-4 py-3 font-medium">
                          {translateDataLabel(bus.name, locale, t)}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`${t("assignments.th.driver")} — ${translateDataLabel(bus.name, locale, t)}`}
                            value={bus.driverUid ?? ""}
                            onChange={(e) => handleDriverChange(bus.id, e.target.value)}
                            className="h-9 rounded border border-dash-outline-variant bg-dash-surface px-2 text-dash-body-sm text-dash-on-surface focus:border-dash-primary focus:outline-none focus:ring-1 focus:ring-dash-primary"
                          >
                            <option value="">{t("assignments.unassigned")}</option>
                            {staff.map((s) => (
                              <option key={s.uid} value={s.uid}>
                                {s.displayName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {toLocaleDigits(String(counts[bus.id] ?? 0), locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Students — paginated list with a per-row bus select */}
            <section className="flex flex-col gap-4">
              {sectionTitle("school", t("assignments.students"))}
              <div className="relative w-56 max-w-sm">
                <Icon
                  name="search"
                  size={18}
                  variant="outlined"
                  className="absolute start-3 top-1/2 -translate-y-1/2 text-dash-outline"
                />
                <input
                  aria-label={t("studentList.searchAria")}
                  type="text"
                  value={students.search}
                  onChange={(e) => students.setSearch(e.target.value)}
                  placeholder={t("studentList.searchPlaceholder")}
                  className="h-10 w-full rounded border border-dash-outline-variant bg-dash-surface ps-9 pe-3 text-dash-body-sm text-dash-on-surface transition-all placeholder:text-dash-outline focus:border-dash-primary focus:outline-none focus:ring-1 focus:ring-dash-primary"
                />
              </div>

              {students.loading && students.students.length === 0 ? (
                <div role="status" className="flex items-center gap-2 py-8 text-dash-body-sm text-dash-on-surface-variant">
                  <Icon name="progress_activity" size={16} variant="outlined" className="animate-spin" />
                  {t("assignments.loadingStudents")}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Icon name="search_off" size={32} variant="outlined" className="text-dash-on-surface-variant" />
                  <p className="text-dash-body-sm text-dash-on-surface-variant">{t("assignments.studentsEmpty")}</p>
                  {students.search && (
                    <p className="text-dash-body-sm text-dash-on-surface-variant">{t("assignments.studentsEmptyHint")}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded border border-dash-outline-variant bg-dash-surface">
                    <table className="w-full min-w-[560px] border-collapse text-start">
                      <thead className="border-b border-dash-outline-variant bg-dash-surface-container text-dash-label-md uppercase text-dash-on-surface-variant">
                        <tr>
                          <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.studentName")}</th>
                          <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.grade")}</th>
                          <th scope="col" className="h-10 px-4 py-2 font-medium">{t("assignments.th.currentBus")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dash-outline-variant text-dash-body-sm text-dash-on-surface">
                        {filteredStudents.map((student) => (
                          <tr key={student.id} className="hover:bg-dash-surface-container-low">
                            <td className="px-4 py-3 font-medium">{student.name}</td>
                            <td className="px-4 py-3">{translateDataLabel(student.grade, locale, t)}</td>
                            <td className="px-4 py-3">
                              <select
                                aria-label={`${t("assignments.th.currentBus")} — ${student.name}`}
                                value={student.busId ?? ""}
                                onChange={(e) => handleStudentBusChange(student, e.target.value)}
                                className="h-9 rounded border border-dash-outline-variant bg-dash-surface px-2 text-dash-body-sm text-dash-on-surface focus:border-dash-primary focus:outline-none focus:ring-1 focus:ring-dash-primary"
                              >
                                <option value="">{t("assignments.noBus")}</option>
                                {buses.map((bus) => (
                                  <option key={bus.id} value={bus.id}>
                                    {translateDataLabel(bus.name, locale, t)}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {students.hasMore && (
                    <button
                      type="button"
                      onClick={students.loadMore}
                      disabled={students.loading}
                      className="flex h-10 items-center gap-2 self-start rounded-full border border-dash-outline-variant bg-dash-surface px-4 text-dash-label-md text-dash-primary transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary disabled:opacity-50"
                    >
                      {students.loading && (
                        <Icon name="progress_activity" size={16} variant="outlined" className="animate-spin" />
                      )}
                      {t("assignments.loadMore")}
                    </button>
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
