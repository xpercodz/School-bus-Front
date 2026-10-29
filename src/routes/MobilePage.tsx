import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { TabId } from "@/data/students";
import { countByStatus, STATUS_CYCLE } from "@/data/students";
import { useRunRoster } from "@/lib/school-data";
import { useOnlineStatus } from "@/lib/use-online-status";
import { BottomBar } from "@/components/BottomBar";
import { Button } from "@/components/arc/button/button";
import { Icon } from "@/components/Icon";
import { RosterList } from "@/components/RosterList";
import { RosterSkeleton } from "@/components/RosterSkeleton";
import { SearchBar } from "@/components/SearchBar";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { StatusChips } from "@/components/StatusChips";
import { StudentHistorySheet } from "@/components/StudentHistorySheet";
import { TopAppBar } from "@/components/TopAppBar";
import { useLocale } from "@/lib/i18n/context";
import { usePageReveal } from "@/lib/use-page-reveal";
import { statusKey } from "@/lib/i18n/format";

export default function Home() {
  const {
    roster,
    loading,
    live,
    cycleStatus,
    completed,
    completeRun,
    markAbsent,
    runMeta,
    runStatus,
    runExists,
  } = useRunRoster();
  const { t } = useLocale();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [historyStudent, setHistoryStudent] = useState<string | null>(null);
  // Screen-reader announcement for a tap-to-cycle change (the button label
  // updates, but some SRs do not re-read a focused control's name).
  const [announcement, setAnnouncement] = useState("");
  usePageReveal(!loading);

  const counts = useMemo(() => countByStatus(roster), [roster]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter(
      (student) =>
        (activeTab === "all" || student.status === activeTab) &&
        (q === "" || student.name.toLowerCase().includes(q)),
    );
  }, [roster, activeTab, query]);

  function handleCycleStatus(id: string) {
    const student = roster.find((item) => item.id === id);
    cycleStatus(id);
    if (!student) return;
    const next =
      STATUS_CYCLE[(STATUS_CYCLE.indexOf(student.status) + 1) % STATUS_CYCLE.length];
    setAnnouncement(`${student.name}: ${t(statusKey(next))}`);
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
            <Icon name="cloud_off" size={16} className="mt-0.5 flex-none text-waiting" />
            {t("mobile.offlineHint")}
          </div>
        )}

        {loading ? (
          <div role="status" aria-label={t("mobile.loading")}>
            <RosterSkeleton />
          </div>
        ) : runMeta.busId === "" ? (
          // Staff account not linked to any bus — nothing to operate on.
          <EmptyState
            icon="directions_bus_off"
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
            <SearchBar query={query} onChange={setQuery} />
            <SegmentedTabs active={activeTab} counts={counts} onSelect={setActiveTab} />
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

      <StudentHistorySheet
        studentName={historyStudent}
        onClose={() => setHistoryStudent(null)}
      />
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
