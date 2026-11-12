import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { TabId } from "@/data/students";
import { countByStatus, STATUS_CYCLE } from "@/data/students";
import { useRunRoster } from "@/lib/school-data";
import { useOnlineStatus } from "@/lib/use-online-status";
import { BottomBar } from "@/components/BottomBar";
import { Button } from "@/components/arc/button/button";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { Icon } from "@/components/Icon";
import { RosterList } from "@/components/RosterList";
import { RosterSkeleton } from "@/components/RosterSkeleton";
import { SearchBar } from "@/components/SearchBar";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { StatusChips } from "@/components/StatusChips";
// The history dialog carries the Arc Calendar (~90 KiB of the entry chunk if it
// is imported eagerly), and the roster is the entry route the driver pays for on
// a phone. It loads the first time a driver actually opens a history, not before.
const StudentHistorySheet = lazy(() =>
  import("@/components/StudentHistorySheet").then((m) => ({ default: m.StudentHistorySheet })),
);
import { TopAppBar } from "@/components/TopAppBar";
import { useLocale } from "@/lib/i18n/context";
import { usePageReveal } from "@/lib/use-page-reveal";
import { statusKey, translateDataLabel } from "@/lib/i18n/format";

export default function Home() {
  const {
    roster,
    loading,
    live,
    cycleStatus,
    completed,
    completeRun,
    markAbsent,
    writeFailed,
    runMeta,
    runStatus,
    runExists,
  } = useRunRoster();
  const { t, locale } = useLocale();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [historyStudent, setHistoryStudent] = useState<string | null>(null);
  // Screen-reader announcement for a tap-to-cycle change (the button label
  // updates, but some SRs do not re-read a focused control's name).
  const [announcement, setAnnouncement] = useState("");
  usePageReveal(!loading);

  const counts = useMemo(() => countByStatus(roster), [roster]);

  // Only grades that actually occur on this run, sorted — the same rule as the
  // director toolbar, so a driver never opens a menu of empty options.
  const grades = useMemo(() => {
    const set = new Set<string>();
    for (const student of roster) {
      if (student.grade) set.add(student.grade);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [roster]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter(
      (student) =>
        (activeTab === "all" || student.status === activeTab) &&
        (grade === null || student.grade === grade) &&
        (q === "" || student.name.toLowerCase().includes(q)),
    );
  }, [roster, activeTab, grade, query]);

  const hasFilters = query.trim() !== "" || grade !== null || activeTab !== "all";

  function clearFilters() {
    setQuery("");
    setGrade(null);
    setActiveTab("all");
  }

  function handleCycleStatus(id: string) {
    const student = roster.find((item) => item.id === id);
    cycleStatus(id);
    if (!student) return;
    const next =
      STATUS_CYCLE[(STATUS_CYCLE.indexOf(student.status) + 1) % STATUS_CYCLE.length];
    // Tapping back to "no record yet" names the action ("Board") rather than a
    // state, matching the pill's own label — that state is never announced.
    setAnnouncement(
      `${student.name}: ${
        next === "WAITING" ? t("mobile.markBoarded") : t(statusKey(next))
      }`,
    );
  }

  // No mock data: without a live session the roster is empty, so prompt to sign in.
  if (!live) {
    return (
      <>
        <TopAppBar runMeta={runMeta} runStatus={runStatus} runExists={runExists} students={roster} />
        <main className="page-enter flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <EmptyState
            icon="login"
            title={t("mobile.signInPromptTitle")}
            body={t("mobile.signInPromptBody")}
            action={
              <Button
                type="button"
                onClick={() => navigate("/login")}
                variant="primary"
                size="md"
                className="mt-1"
              >
                <Icon name="login" size={18} />
                {t("mobile.signInAction")}
              </Button>
            }
          />
        </main>
      </>
    );
  }

  const showNoRun = !loading && runMeta.busId !== "" && !runExists;

  return (
    <>
      <TopAppBar runMeta={runMeta} runStatus={runStatus} runExists={runExists} students={roster} />
      <main className="page-enter flex-1 space-y-3 px-4 py-3 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        {!online && (
          <div
            role="status"
            className="stagger-in flex items-start gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-[12.5px] leading-4 text-on-surface-variant"
          >
            <Icon name="cloud_off" size={16} className="mt-0.5 flex-none text-dash-warning" />
            {t("mobile.offlineHint")}
          </div>
        )}

        {/* A tap that could not be written. The roster shows no change either
            way, so without this the record would be lost silently. */}
        {writeFailed && (
          <div
            role="alert"
            className="stagger-in flex items-start gap-2 rounded-lg border border-dash-error bg-dash-error-container px-3 py-2.5 text-[12.5px] leading-4 text-dash-on-error-container"
          >
            <Icon name="cancel" size={16} className="mt-0.5 flex-none" />
            {t("mobile.writeFailed")}
          </div>
        )}

        {loading ? (
          <div role="status" aria-label={t("mobile.loading")}>
            <RosterSkeleton />
          </div>
        ) : runMeta.busId === "" ? (
          // Staff account not linked to any bus — nothing to operate on.
          <EmptyState
            icon="directions_bus"
            title={t("mobile.noBusTitle")}
            body={t("mobile.noBusBody")}
          />
        ) : showNoRun ? (
          <EmptyState
            icon="event_busy"
            title={t("mobile.noRunTitle")}
            body={t("mobile.noRunBody")}
          />
        ) : (
          <>
            <StatusChips counts={counts} />

            {/* Search + grade, one 44px row. The search owns the free width so
                its foldable field grows away from its start-edge icon and never
                pushes the select off a 320px phone. */}
            <div data-page-reveal className="flex items-center gap-2">
              <SearchBar
                query={query}
                onChange={setQuery}
                className="group/search min-w-0 flex-1"
              />
              <DropdownMenu
                ariaLabel={t("studentList.gradeAria")}
                label={
                  grade ? translateDataLabel(grade, locale, t) : t("studentList.allGrades")
                }
                align="start"
                matchTriggerWidth
                triggerClassName="arc-field h-11 flex-none"
                items={[
                  {
                    label: t("studentList.allGrades"),
                    checked: !grade,
                    onSelect: () => setGrade(null),
                  },
                  ...grades.map((g) => ({
                    label: translateDataLabel(g, locale, t),
                    checked: g === grade,
                    onSelect: () => setGrade(g),
                  })),
                ]}
              />
            </div>

            {/* The status filters keep the full rail; the clear action sits
                beside it (as on the director roster) so the search field never
                changes width mid-typing. */}
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1">
                <SegmentedTabs active={activeTab} counts={counts} onSelect={setActiveTab} />
              </div>
              {hasFilters && (
                <Button
                  type="button"
                  onClick={clearFilters}
                  aria-label={t("studentList.clear")}
                  variant="secondary"
                  size="md"
                  icon
                  className="arc-field flex-none"
                >
                  <Icon name="filter_alt_off" size={18} />
                </Button>
              )}
            </div>

            <RosterList
              students={filtered}
              onCycleStatus={handleCycleStatus}
              onMarkAbsent={markAbsent}
              onViewHistory={setHistoryStudent}
              disabled={completed}
            />
          </>
        )}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </main>
      {runMeta.busId !== "" && live && runExists && !loading && (
        <BottomBar completed={completed} onComplete={completeRun} />
      )}

      {historyStudent !== null && (
        <Suspense fallback={null}>
          <StudentHistorySheet
            studentName={historyStudent}
            onClose={() => setHistoryStudent(null)}
          />
        </Suspense>
      )}
    </>
  );
}

/**
 * One quiet, intentional empty state for the driver screens: a neutral mark,
 * the reason, and (when there is something to do) the action. Shared by the
 * sign-in prompt, the no-bus account and the not-yet-dispatched run.
 */
function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="pop-in flex h-14 w-14 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-lowest text-outline">
        <Icon name={icon} size={26} />
      </span>
      <h2 className="text-[18px] font-semibold text-on-surface">{title}</h2>
      <p className="max-w-sm text-[13.5px] leading-5 text-on-surface-variant">{body}</p>
      {action}
    </div>
  );
}
