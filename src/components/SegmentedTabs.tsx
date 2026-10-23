import { useEffect, useRef, type KeyboardEvent } from "react";
import type { StudentStatus } from "@/data/students";
import { TABS, type TabId } from "@/data/students";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";

/** Tab label key per TabId — DROPPED_OFF's tab reads "Done" (matches the design). */
const TAB_LABEL_KEY: Record<TabId, MessageKey> = {
  all: "tabs.all",
  WAITING: "tabs.waiting",
  BOARDED: "tabs.boarded",
  DROPPED_OFF: "tabs.done",
  ABSENT: "status.absent", // ABSENT has no tab; harmless fallback
};

interface SegmentedTabsProps {
  active: TabId;
  counts: Record<StudentStatus, number>;
  onSelect: (tab: TabId) => void;
}

/**
 * Status filters for the roster. A real segmented filter rather than an ARIA
 * tablist: there is no tabpanel — the list below is filtered in place — so the
 * buttons are `aria-pressed` toggles in a labelled group. A sliding underline
 * carries the selection, and arrow keys move between filters as a convenience.
 */
export function SegmentedTabs({ active, counts, onSelect }: SegmentedTabsProps) {
  const { t, dir, locale } = useLocale();
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    all: null,
    BOARDED: null,
    WAITING: null,
    DROPPED_OFF: null,
    ABSENT: null,
  });
  const activeIndex = Math.max(0, TABS.findIndex((tab) => tab.id === active));

  // On a narrow phone the row scrolls sideways; keep the selected filter in
  // view when switching from code or after an Arabic label change.
  useEffect(() => {
    tabRefs.current[active]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((tab) => tab.id === active);
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backward = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next = -1;
    if (event.key === forward) next = (current + 1) % TABS.length;
    else if (event.key === backward) next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === -1) return;
    event.preventDefault();
    const target = TABS[next];
    onSelect(target.id);
    tabRefs.current[target.id]?.focus();
  }

  return (
    <div
      data-page-reveal
      role="group"
      aria-label={t("tabs.filterAria")}
      onKeyDown={handleKeyDown}
      className="no-scrollbar relative flex overflow-x-auto border-b border-outline-variant"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const count = tab.id === "all" ? total : counts[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={isActive}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            onClick={() => onSelect(tab.id)}
            className={`press-none flex h-12 min-w-[72px] flex-1 items-center justify-center gap-1 whitespace-nowrap px-2 text-[12.5px] transition-colors ${
              isActive
                ? "font-semibold text-on-surface"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t(TAB_LABEL_KEY[tab.id])}
            <span className="text-[11px] tabular-nums text-on-surface-variant">
              {toLocaleDigits(String(count), locale)}
            </span>
          </button>
        );
      })}
      {/* Sliding underline: one fourth of the track per filter. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-on-surface transition-transform duration-[var(--t-ui)] ease-[var(--ease-out-soft)] motion-reduce:transition-none"
        style={{
          width: `${100 / TABS.length}%`,
          transform:
            activeIndex === 0
              ? "translateX(0)"
              : dir === "rtl"
                ? `translateX(-${activeIndex * 100}%)`
                : `translateX(${activeIndex * 100}%)`,
        }}
      />
    </div>
  );
}
