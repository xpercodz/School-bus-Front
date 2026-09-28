import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { TabId } from "@/data/students";
import { countByStatus } from "@/data/students";
import { useRunRoster } from "@/lib/school-data";
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
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <Icon name="login" size={40} className="text-on-surface-variant" />
          <h2 className="text-headline-md">{t("mobile.signInPromptTitle")}</h2>
          <p className="max-w-sm text-body-md text-on-surface-variant">
            {t("mobile.signInPromptBody")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-2 flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-label-lg text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="login" size={18} />
            {t("mobile.signInAction")}
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <TopAppBar runMeta={runMeta} runStatus={runStatus} runExists={runExists} />
      <main className="flex-1 space-y-6 px-4 py-4">
        {loading ? (
          <div role="status" aria-label={t("mobile.loading")}>
            <RosterSkeleton />
          </div>
        ) : runMeta.busId === "" ? (
          // Staff account not linked to any bus — nothing to operate on.
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <Icon
              name="directions_bus_off"
              size={40}
              className="text-on-surface-variant"
            />
            <h2 className="text-headline-md">{t("mobile.noBusTitle")}</h2>
            <p className="max-w-sm text-body-md text-on-surface-variant">
              {t("mobile.noBusBody")}
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
      {runMeta.busId !== "" && (
        <BottomBar completed={completed} onComplete={completeRun} />
      )}

      <StudentHistorySheet
        studentName={historyStudent}
        onClose={() => setHistoryStudent(null)}
      />
    </>
  );
}
