/**
 * THE GUIDEBOOK — a manual for the dashboard, one page per screen.
 *
 * The rail is the contents, the search finds a sentence rather than a title, and
 * the right column is ONE page at a time: a headline, one TL;DR sentence, a
 * drawing of the screen with a pin per step, the steps those pins point at, and
 * the words the screen uses.
 *
 * ⚠️ THE CONTENTS ARE THE READER'S PERMISSION SET. `guideContents` decides which
 * pages open and which are listed as somebody else's (see `lib/guide.ts`). No
 * role name is read here, so a role changed in Operators changes the manual with
 * no code change.
 *
 * ⚠️ THE SECTION IS A QUERY PARAM, not a path segment. The dashboard shell keys
 * `<main>` on `pathname`, so a path segment would remount and re-animate the
 * whole rail on every click. `?s=reports` keeps the page mounted, keeps the
 * search term, and is still a link somebody can send.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/arc/button/button";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { ExpandingSearch } from "@/components/arc/expanding-search/expanding-search";
import { GuideMap } from "@/components/guide/GuideMap";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useTour } from "@/components/dashboard/Tour";
import { guideContents, searchGuide, visibleSection, type GuideSection } from "@/lib/guide";
import { useLocale } from "@/lib/i18n/context";
import { useMainDirector } from "@/lib/main-director";
import { useUserProfile } from "@/lib/user-profile";

const GUIDE_PATH = "/dashboard/guide";

function sectionHref(id: string): string {
  return `${GUIDE_PATH}?s=${id}`;
}

export default function GuidePage() {
  const { t, dir } = useLocale();
  const { profile } = useUserProfile();
  const mainDirector = useMainDirector();
  const { start } = useTour();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState("");

  const { mine, locked } = useMemo(
    () => guideContents(profile, mainDirector),
    [mainDirector, profile],
  );

  const requested = params.get("s") ?? "";
  const current: GuideSection | null =
    visibleSection(profile, mainDirector, requested) ?? mine[0] ?? null;
  const isLocked =
    current !== null && !mine.some((section) => section.id === current.id);

  const hits = useMemo(
    () => searchGuide(profile, mainDirector, t, term),
    [mainDirector, profile, t, term],
  );

  function open(id: string) {
    setTerm("");
    setParams({ s: id });
  }

  // A section change starts at the top: the rail stays where it is, and the
  // reader is not left halfway down the previous page.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [current?.id]);

  const back = dir === "rtl" ? "arrow_forward" : "arrow_back";
  const forward = dir === "rtl" ? "arrow_back" : "arrow_forward";

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-5 sm:px-6 sm:pt-6">
      <PageHeader
        title={t("guide.title")}
        subtitle={t("guide.lead")}
        actions={
          /* The wrapper, not the Button, carries the breakpoint: PageHeader
             stretches every action to full width on a phone, and a page-wide
             "Show me around" would read as the screen's main job. On a phone the
             replay sits under the section picker instead (below). */
          <span className="hidden sm:inline-flex">
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="arc-field"
              onClick={start}
            >
              <Icon name="help" size={16} variant="outlined" />
              {t("guide.replayTour")}
            </Button>
          </span>
        }
      />

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-10">
        {/* Contents — a rail on desktop, a picker on a phone. */}
        <aside className="hidden lg:block lg:w-[204px] lg:flex-none">
          <div className="sticky top-4 flex flex-col gap-3">
            <ExpandingSearch
              anchor="start"
              label={t("guide.searchAria")}
              placeholder={t("guide.searchPlaceholder")}
              clearLabel={t("mobile.clearSearchAria")}
              value={term}
              onValueChange={setTerm}
            />

            {term.trim() === "" ? (
              <Contents
                mine={mine}
                locked={locked}
                currentId={current?.id ?? ""}
                onOpen={open}
              />
            ) : (
              <Hits hits={hits} term={term} onOpen={open} />
            )}

            {locked.length > 0 && (
              <p className="px-2 text-[11.5px] leading-5 text-dash-on-surface-variant">
                {t("guide.lockedHint")}
              </p>
            )}
          </div>
        </aside>

        {/* The same two controls on a phone, stacked above the page. */}
        <div className="flex flex-col gap-2 lg:hidden">
          <ExpandingSearch
            anchor="start"
            label={t("guide.searchAria")}
            placeholder={t("guide.searchPlaceholder")}
            clearLabel={t("mobile.clearSearchAria")}
            value={term}
            onValueChange={setTerm}
          />
          {term.trim() !== "" ? (
            <Hits hits={hits} term={term} onOpen={open} />
          ) : (
            <DropdownMenu
              label={
                current === null ? t("guide.pickerLabel") : t(current.titleKey)
              }
              ariaLabel={t("guide.pickerLabel")}
              align="start"
              matchTriggerWidth
              triggerClassName="w-full"
              searchable={{
                placeholder: t("dropdown.searchPlaceholder"),
                emptyLabel: t("dropdown.searchEmpty"),
              }}
              items={[
                ...mine.map((section) => ({
                  label: t(section.titleKey),
                  checked: section.id === current?.id,
                  onSelect: () => open(section.id),
                })),
                ...locked.map((section, index) => ({
                  label: t(section.titleKey),
                  separatorBefore: index === 0,
                  onSelect: () => open(section.id),
                })),
              ]}
            />
          )}
          <button
            type="button"
            onClick={start}
            className="flex h-9 items-center gap-2 self-start rounded-md px-2 text-[13px] text-dash-on-surface-variant transition-colors hover:text-dash-on-surface"
          >
            <Icon name="help" size={16} variant="outlined" />
            {t("guide.replayTour")}
          </button>
        </div>

        <article className="min-w-0 flex-1">
          {current === null ? (
            <p className="max-w-[62ch] text-[15px] leading-7 text-dash-on-surface">
              {t("guide.lockedBody")}
            </p>
          ) : (
            <>
              <header>
                <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.01em] text-dash-on-surface">
                  {t(current.titleKey)}
                </h2>
                <p className="mt-1.5 max-w-[62ch] text-[15px] leading-7 text-dash-on-surface">
                  {t(current.tldrKey)}
                </p>
              </header>

              {isLocked && (
                <div className="mt-4 rounded-lg border border-dash-outline-variant bg-dash-surface p-4">
                  <h3 className="text-[13px] font-semibold text-dash-on-surface">
                    {t("guide.lockedTitle")}
                  </h3>
                  <p className="mt-1 max-w-[62ch] text-[13px] leading-6 text-dash-on-surface-variant">
                    {t("guide.lockedBody")}
                  </p>
                </div>
              )}

              <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] xl:items-start">
                <GuideMap map={current.id} caption={t(current.captionKey)} />

                <div className="flex flex-col gap-8">
                  <section aria-labelledby="guide-steps">
                    <h3
                      id="guide-steps"
                      className="text-[13px] font-semibold text-dash-on-surface"
                    >
                      {t("guide.stepsHeading")}
                    </h3>
                    <ol className="mt-3 flex flex-col gap-4">
                      {current.steps.map((step, index) => (
                        <li
                          key={step.titleKey}
                          className="grid grid-cols-[22px_minmax(0,1fr)] gap-3"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-0.5 grid size-[22px] place-items-center rounded-full bg-dash-primary-container text-[11px] font-semibold tabular-nums text-dash-on-primary-container"
                          >
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-[13.5px] font-semibold leading-5 text-dash-on-surface">
                              {t(step.titleKey)}
                            </p>
                            <p className="mt-0.5 text-[13px] leading-6 text-dash-on-surface-variant">
                              {t(step.bodyKey)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>

                  <section aria-labelledby="guide-words">
                    <h3
                      id="guide-words"
                      className="text-[13px] font-semibold text-dash-on-surface"
                    >
                      {t("guide.wordsHeading")}
                    </h3>
                    <dl className="mt-3 flex flex-col gap-3">
                      {current.words.map((word) => (
                        <div key={word.termKey}>
                          <dt className="text-[13px] font-semibold text-dash-on-surface">
                            {t(word.termKey)}
                          </dt>
                          <dd className="mt-0.5 text-[13px] leading-6 text-dash-on-surface-variant">
                            {t(word.meaningKey)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>
              </div>

              <Pager mine={mine} currentId={current.id} back={back} forward={forward} />
            </>
          )}
        </article>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The contents                                                                */
/* -------------------------------------------------------------------------- */

function Row({
  section,
  currentId,
  onOpen,
}: {
  section: GuideSection;
  currentId: string;
  onOpen: (id: string) => void;
}) {
  const { t } = useLocale();
  const active = section.id === currentId;
  return (
    <li>
      <Link
        to={sectionHref(section.id)}
        aria-current={active ? "page" : undefined}
        onClick={(event) => {
          event.preventDefault();
          onOpen(section.id);
        }}
        className={`flex h-9 items-center rounded-md px-2 text-[13.5px] transition-colors ${
          active
            ? "bg-dash-secondary-container font-medium text-dash-on-surface"
            : "text-dash-on-surface-variant hover:bg-dash-surface-container-low hover:text-dash-on-surface"
        }`}
      >
        {t(section.titleKey)}
      </Link>
    </li>
  );
}

function Contents({
  mine,
  locked,
  currentId,
  onOpen,
}: {
  mine: GuideSection[];
  locked: GuideSection[];
  currentId: string;
  onOpen: (id: string) => void;
}) {
  const { t } = useLocale();
  return (
    <>
      <p className="px-2 text-[12px] font-medium text-dash-on-surface-variant">
        {t("guide.contents")}
      </p>
      <nav aria-label={t("guide.contents")}>
        <ul className="flex flex-col gap-0.5">
          {mine.map((section) => (
            <Row
              key={section.id}
              section={section}
              currentId={currentId}
              onOpen={onOpen}
            />
          ))}
        </ul>
      </nav>

      {locked.length > 0 && (
        <>
          <p className="mt-3 px-2 text-[12px] font-medium text-dash-on-surface-variant">
            {t("guide.lockedLabel")}
          </p>
          <nav aria-label={t("guide.lockedLabel")}>
            <ul className="flex flex-col gap-0.5 opacity-80">
              {locked.map((section) => (
                <Row
                  key={section.id}
                  section={section}
                  currentId={currentId}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          </nav>
        </>
      )}
    </>
  );
}

function Hits({
  hits,
  term,
  onOpen,
}: {
  hits: ReturnType<typeof searchGuide>;
  term: string;
  onOpen: (id: string) => void;
}) {
  const { t } = useLocale();
  return (
    <div>
      <p className="px-2 text-[12px] font-medium text-dash-on-surface-variant">
        {t("guide.searchAria")}
      </p>
      {hits.length === 0 ? (
        <p className="mt-1 px-2 text-[12.5px] leading-5 text-dash-on-surface-variant">
          {t("guide.searchEmpty", { term })}
        </p>
      ) : (
        <ul className="mt-1 flex flex-col gap-0.5">
          {hits.map((hit) => (
            <li key={hit.section.id}>
              <button
                type="button"
                onClick={() => onOpen(hit.section.id)}
                className="block w-full rounded-md px-2 py-1.5 text-start transition-colors hover:bg-dash-surface-container-low"
              >
                <span className="block text-[13.5px] font-medium text-dash-on-surface">
                  {t(hit.section.titleKey)}
                  {hit.locked && (
                    <span className="ms-1.5 text-[11px] font-normal text-dash-on-surface-variant">
                      · {t("guide.lockedLabel")}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[12px] leading-5 text-dash-on-surface-variant">
                  {t(hit.matchKey)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Pager({
  mine,
  currentId,
  back,
  forward,
}: {
  mine: GuideSection[];
  currentId: string;
  back: string;
  forward: string;
}) {
  const { t } = useLocale();
  const index = mine.findIndex((section) => section.id === currentId);
  const previous = index > 0 ? mine[index - 1] : undefined;
  const next = index >= 0 ? mine[index + 1] : undefined;

  return (
    <nav
      aria-label={t("guide.contents")}
      className="mt-10 flex items-center justify-between gap-4 border-t border-dash-outline-variant pt-4"
    >
      {previous === undefined ? (
        <span />
      ) : (
        <Link
          to={sectionHref(previous.id)}
          className="flex items-center gap-1.5 text-[12.5px] text-dash-on-surface-variant transition-colors hover:text-dash-on-surface"
        >
          <Icon name={back} size={16} variant="outlined" />
          {t(previous.titleKey)}
        </Link>
      )}
      {next === undefined ? (
        <span />
      ) : (
        <Link
          to={sectionHref(next.id)}
          className="flex items-center gap-1.5 text-[12.5px] text-dash-on-surface-variant transition-colors hover:text-dash-on-surface"
        >
          {t(next.titleKey)}
          <Icon name={forward} size={16} variant="outlined" />
        </Link>
      )}
    </nav>
  );
}
