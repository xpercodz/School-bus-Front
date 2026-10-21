import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { TabId } from "@/data/students";
import { countByStatus } from "@/data/students";
import { useRunRoster } from "@/lib/school-data";
import { useOnlineStatus } from "@/lib/use-online-status";
import { BottomBar } from "@/components/BottomBar";
import { Icon } from "@/components/Icon";
import { RosterList } from "@/components/RosterList";
import { RosterSkeleton } from "@/components/RosterSkeleton";
import { SearchBar } from "@/components/SearchBar";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { StatusChips } from "@/components/StatusChips";
import { StudentHistorySheet } from "@/components/StudentHistorySheet";
import { TopAppBar } from "@/components/TopAppBar";
import { useLocale } from "@/lib/i18n/context";

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

  const counts = useMemo(() => countByStatus(roster), [roster]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter(
      (student) =>
        (activeTab === "all" || student.status === activeTab) &&
        (q === "" || student.name.toLowerCase().includes(q)),
    );
  }, [roster, activeTab, query]);

  // No mock data: without a live session the roster is empty, so prompt to sign in.
  if (!live) {
    return (
      <>
        <TopAppBar runMeta={runMeta} runStatus={runStatus} runExists={runExists} />
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <Icon name="login" size={28} className="text-outline" />
          <h2 className="text-[18px] font-semibold text-on-surface">
            {t("mobile.signInPromptTitle")}
          </h2>
          <p className="max-w-sm text-[13.5px] leading-5 text-on-surface-variant">
            {t("mobile.signInPromptBody")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-2 flex h-11 items-center gap-2 rounded-md bg-on-surface px-5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          >
            <Icon name="login" size={18} />
            {t("mobile.signInAction")}
          </button>
        </main>
      </>
    );
  }

  const showNoRun = !loading && runMeta.busId !== "" && !runExists;

  return (
    <>
      <TopAppBar runMeta={runMeta} runStatus={runStatus} runExists={runExists} />
      <main className="flex-1 space-y-3 px-3 py-3 pb-24">
        {!online && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-[12px] leading-4 text-on-surface-variant"
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
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Icon name="directions_bus_off" size={28} className="text-outline" />
            <h2 className="text-[18px] font-semibold text-on-surface">{t("mobile.noBusTitle")}</h2>
            <p className="max-w-sm text-[13.5px] leading-5 text-on-surface-variant">
              {t("mobile.noBusBody")}
            </p>
          </div>
        ) : showNoRun ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Icon name="event_busy" size={28} className="text-outline" />
            <h2 className="text-[18px] font-semibold text-on-surface">{t("mobile.noRunTitle")}</h2>
            <p className="max-w-sm text-[13.5px] leading-5 text-on-surface-variant">
              {t("mobile.noRunBody")}
            </p>
          </div>
        ) : (
          <>
            <StatusChips counts={counts} />
            <SearchBar query={query} onChange={setQuery} />
            <SegmentedTabs active={activeTab} counts={counts} onSelect={setActiveTab} />
            <RosterList
              students={filtered}
              onCycleStatus={cycleStatus}
              onMarkAbsent={markAbsent}
              onViewHistory={setHistoryStudent}
              disabled={completed}
            />
          </>
        )}
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
