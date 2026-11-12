/**
 * THE GUIDEBOOK'S PAGES, and who may read which.
 *
 * One entry per screen, and `screen` is the SAME id `permissions.ts` gates the
 * route with — so the manual cannot drift from the app: grant an operator a
 * screen and its page opens for them, revoke it and the page moves under "Not
 * yours to open" without a line changed here.
 *
 * ⚠️ A LOCKED PAGE IS STILL LISTED. The manual's job is to explain the whole
 * dashboard, and "that is somebody else's screen" is the answer to half the
 * questions it gets. Only `firstSection` and the rail's open state read `mine`.
 *
 * ⚠️ THE COPY IS KEYS, NOT STRINGS. Every sentence is a `guide.*` entry in both
 * dictionaries, so the page is Arabic when the app is.
 */
import { canOpenScreen, type ScreenId } from "@/lib/permissions";
import type { MessageKey } from "@/lib/i18n/types";
import type { UserProfile } from "@/lib/user-profile";

/** Which miniature the page draws. See `components/guide/GuideMap.tsx`. */
export type GuideMapId =
  | "live"
  | "students"
  | "reports"
  | "assignments"
  | "drivers"
  | "operators"
  | "activity"
  | "legend";

export interface GuideSection {
  id: GuideMapId;
  /** The rail label and the page's h2. Reuses the nav key where one exists. */
  titleKey: MessageKey;
  /** The TL;DR under the heading. One sentence, never a paragraph. */
  tldrKey: MessageKey;
  /** What the miniature shows, one line. */
  captionKey: MessageKey;
  /**
   * The screen that opens this page, in the same vocabulary as the route guard.
   * Absent = every reader in the dashboard may open it (the legend grants
   * nothing and explains everyone's colours).
   */
  screen?: ScreenId;
  steps: readonly { titleKey: MessageKey; bodyKey: MessageKey }[];
  words: readonly { termKey: MessageKey; meaningKey: MessageKey }[];
}

export const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    id: "live",
    titleKey: "nav.liveMap",
    tldrKey: "guide.live.tldr",
    captionKey: "guide.live.caption",
    screen: "live",
    steps: [
      { titleKey: "guide.live.s1.title", bodyKey: "guide.live.s1.body" },
      { titleKey: "guide.live.s2.title", bodyKey: "guide.live.s2.body" },
      { titleKey: "guide.live.s3.title", bodyKey: "guide.live.s3.body" },
    ],
    words: [
      { termKey: "dashboard.accountedLabel", meaningKey: "guide.live.w1.meaning" },
      { termKey: "dashboard.runTypeAria", meaningKey: "guide.live.w2.meaning" },
    ],
  },
  {
    id: "students",
    titleKey: "nav.students",
    tldrKey: "guide.students.tldr",
    captionKey: "guide.students.caption",
    screen: "students",
    steps: [
      { titleKey: "guide.students.s1.title", bodyKey: "guide.students.s1.body" },
      { titleKey: "guide.students.s2.title", bodyKey: "guide.students.s2.body" },
      { titleKey: "guide.students.s3.title", bodyKey: "guide.students.s3.body" },
    ],
    words: [
      { termKey: "guide.students.w1.term", meaningKey: "guide.students.w1.meaning" },
      { termKey: "guide.students.w2.term", meaningKey: "guide.students.w2.meaning" },
    ],
  },
  {
    id: "reports",
    titleKey: "nav.reports",
    tldrKey: "guide.reports.tldr",
    captionKey: "guide.reports.caption",
    screen: "reports",
    steps: [
      { titleKey: "guide.reports.s1.title", bodyKey: "guide.reports.s1.body" },
      { titleKey: "guide.reports.s2.title", bodyKey: "guide.reports.s2.body" },
      { titleKey: "guide.reports.s3.title", bodyKey: "guide.reports.s3.body" },
    ],
    words: [
      { termKey: "guide.reports.w1.term", meaningKey: "guide.reports.w1.meaning" },
      { termKey: "guide.reports.w2.term", meaningKey: "guide.reports.w2.meaning" },
    ],
  },
  {
    id: "assignments",
    titleKey: "nav.assignments",
    tldrKey: "guide.assignments.tldr",
    captionKey: "guide.assignments.caption",
    screen: "assignments",
    steps: [
      { titleKey: "guide.assignments.s1.title", bodyKey: "guide.assignments.s1.body" },
      { titleKey: "guide.assignments.s2.title", bodyKey: "guide.assignments.s2.body" },
      { titleKey: "guide.assignments.s3.title", bodyKey: "guide.assignments.s3.body" },
    ],
    words: [
      { termKey: "guide.assignments.w1.term", meaningKey: "guide.assignments.w1.meaning" },
      { termKey: "guide.assignments.w2.term", meaningKey: "guide.assignments.w2.meaning" },
    ],
  },
  {
    id: "drivers",
    titleKey: "nav.drivers",
    tldrKey: "guide.drivers.tldr",
    captionKey: "guide.drivers.caption",
    screen: "drivers",
    steps: [
      { titleKey: "guide.drivers.s1.title", bodyKey: "guide.drivers.s1.body" },
      { titleKey: "guide.drivers.s2.title", bodyKey: "guide.drivers.s2.body" },
      { titleKey: "guide.drivers.s3.title", bodyKey: "guide.drivers.s3.body" },
    ],
    words: [
      { termKey: "guide.drivers.w1.term", meaningKey: "guide.drivers.w1.meaning" },
      { termKey: "drivers.generateCode", meaningKey: "guide.drivers.w2.meaning" },
    ],
  },
  {
    id: "operators",
    titleKey: "nav.operators",
    tldrKey: "guide.operators.tldr",
    captionKey: "guide.operators.caption",
    screen: "operators",
    steps: [
      { titleKey: "guide.operators.s1.title", bodyKey: "guide.operators.s1.body" },
      { titleKey: "guide.operators.s2.title", bodyKey: "guide.operators.s2.body" },
      { titleKey: "guide.operators.s3.title", bodyKey: "guide.operators.s3.body" },
    ],
    words: [
      { termKey: "role.mainDirector", meaningKey: "guide.operators.w1.meaning" },
      { termKey: "guide.operators.w2.term", meaningKey: "guide.operators.w2.meaning" },
    ],
  },
  {
    id: "activity",
    titleKey: "nav.activity",
    tldrKey: "guide.activity.tldr",
    captionKey: "guide.activity.caption",
    screen: "activity",
    steps: [
      { titleKey: "guide.activity.s1.title", bodyKey: "guide.activity.s1.body" },
      { titleKey: "guide.activity.s2.title", bodyKey: "guide.activity.s2.body" },
      { titleKey: "guide.activity.s3.title", bodyKey: "guide.activity.s3.body" },
    ],
    words: [
      { termKey: "guide.activity.w1.term", meaningKey: "guide.activity.w1.meaning" },
      { termKey: "guide.activity.w2.term", meaningKey: "guide.activity.w2.meaning" },
    ],
  },
  {
    id: "legend",
    titleKey: "guide.legend.title",
    tldrKey: "guide.legend.tldr",
    captionKey: "guide.legend.caption",
    steps: [
      { titleKey: "guide.legend.s1.title", bodyKey: "guide.legend.s1.body" },
      { titleKey: "guide.legend.s2.title", bodyKey: "guide.legend.s2.body" },
      { titleKey: "guide.legend.s3.title", bodyKey: "guide.legend.s3.body" },
    ],
    words: [
      { termKey: "guide.legend.w1.term", meaningKey: "guide.legend.w1.meaning" },
      { termKey: "guide.legend.w2.term", meaningKey: "guide.legend.w2.meaning" },
    ],
  },
];

export interface GuideContents {
  /** The pages this reader may open, in the manual's order. */
  mine: GuideSection[];
  /** The pages they may not — listed, never hidden. */
  locked: GuideSection[];
}

export function guideContents(
  profile: UserProfile,
  mainDirector: boolean,
): GuideContents {
  const mine: GuideSection[] = [];
  const locked: GuideSection[] = [];
  for (const section of GUIDE_SECTIONS) {
    const open =
      section.screen === undefined ||
      canOpenScreen(profile, section.screen, mainDirector);
    (open ? mine : locked).push(section);
  }
  return { mine, locked };
}

/**
 * The page the address names, if THIS reader may see it at all (open or listed
 * as locked). An unknown id is `undefined`, and the page falls back to `mine[0]`.
 */
export function visibleSection(
  profile: UserProfile,
  mainDirector: boolean,
  id: string,
): GuideSection | undefined {
  const { mine, locked } = guideContents(profile, mainDirector);
  return mine.find((s) => s.id === id) ?? locked.find((s) => s.id === id);
}

export interface GuideHit {
  section: GuideSection;
  /** The one line that matched — rendered under the result. */
  matchKey: MessageKey;
  locked: boolean;
}

/**
 * The search, over the words the reader can actually see.
 *
 * It searches the TRANSLATED copy, not the keys, so it works in Arabic. `t` is
 * passed in rather than imported, which keeps this module pure and lets the
 * caller decide the language.
 */
export function searchGuide(
  profile: UserProfile,
  mainDirector: boolean,
  t: (key: MessageKey) => string,
  term: string,
): GuideHit[] {
  const needle = term.trim().toLowerCase();
  if (needle === "") return [];
  const { mine, locked } = guideContents(profile, mainDirector);
  const open = new Set(mine.map((section) => section.id));
  const hits: GuideHit[] = [];

  for (const section of [...mine, ...locked]) {
    const candidates: MessageKey[] = [
      section.titleKey,
      section.tldrKey,
      ...section.steps.flatMap((step) => [step.titleKey, step.bodyKey]),
      ...section.words.flatMap((word) => [word.termKey, word.meaningKey]),
    ];
    const matchKey = candidates.find((key) =>
      t(key).toLowerCase().includes(needle),
    );
    if (matchKey === undefined) continue;
    hits.push({ section, matchKey, locked: !open.has(section.id) });
  }
  return hits;
}
