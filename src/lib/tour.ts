/**
 * THE DASHBOARD TOUR: which controls to light up, in what order, and for whom.
 *
 * A step is a PAGE, a SELECTOR and two sentences. The selector sits on the real
 * control, so a step can never describe markup that is not there; the page lets
 * the tour walk a director from the monitor to every screen they own without
 * asking them to find it.
 *
 * ⚠️ `screen` IS THE SAME GATE THE ROUTE USES (`permissions.ts`), so the tour can
 * never advertise a screen the reader was not granted. A director meets every
 * stop; an operator granted only Students meets the shell, the roll and the
 * closing card, and the tour never tries to open a page they do not hold.
 *
 * ⚠️ A STEP WITHOUT A `path` STAYS WHERE THE READER IS. Only the closing card
 * uses that: it points at Help, which is in the rail on every screen.
 */
import { canOpenScreen, type ScreenId } from "@/lib/permissions";
import type { MessageKey } from "@/lib/i18n/types";
import type { UserProfile } from "@/lib/user-profile";

export interface TourStep {
  id: string;
  /** The screen the control lives on. Absent = stay on the current page. */
  path?: string;
  /**
   * CSS selector for the control. Absent = a centred card (the closing step).
   * The component tries the selector on the page at `path`.
   */
  target?: string;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  /** Only for a reader who can open this screen. */
  screen?: ScreenId;
  /**
   * No target on screen → show the step centred instead of dropping it. Used by
   * steps whose control is in the rail, which is a closed drawer on a phone.
   */
  centredFallback?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "nav",
    path: "/dashboard",
    target: '[data-tour="nav"]',
    centredFallback: true,
    titleKey: "tour.step.nav.title",
    bodyKey: "tour.step.nav.body",
  },
  {
    id: "scope",
    path: "/dashboard",
    target: '[data-tour="scope"]',
    screen: "live",
    titleKey: "tour.step.scope.title",
    bodyKey: "tour.step.scope.body",
  },
  {
    id: "summary",
    path: "/dashboard",
    target: '[data-tour="summary"]',
    screen: "live",
    titleKey: "tour.step.summary.title",
    bodyKey: "tour.step.summary.body",
  },
  {
    id: "routes",
    path: "/dashboard",
    target: '[data-tour="routes"]',
    screen: "live",
    titleKey: "tour.step.routes.title",
    bodyKey: "tour.step.routes.body",
  },
  {
    id: "actions",
    path: "/dashboard",
    target: '[data-tour="actions"]',
    screen: "live",
    titleKey: "tour.step.actions.title",
    bodyKey: "tour.step.actions.body",
  },

  {
    id: "studentsRoll",
    path: "/dashboard/students",
    target: '[data-tour="students-roll"]',
    screen: "students",
    titleKey: "tour.step.studentsRoll.title",
    bodyKey: "tour.step.studentsRoll.body",
  },
  {
    id: "studentsToolbar",
    path: "/dashboard/students",
    target: '[data-tour="students-toolbar"]',
    screen: "students",
    titleKey: "tour.step.studentsToolbar.title",
    bodyKey: "tour.step.studentsToolbar.body",
  },
  {
    id: "studentsHistory",
    path: "/dashboard/students",
    target: '[data-tour="students-history"]',
    screen: "students",
    titleKey: "tour.step.studentsHistory.title",
    bodyKey: "tour.step.studentsHistory.body",
  },

  {
    id: "reportsOverview",
    path: "/dashboard/reports",
    target: '[data-tour="reports-overview"]',
    screen: "reports",
    titleKey: "tour.step.reportsOverview.title",
    bodyKey: "tour.step.reportsOverview.body",
  },
  {
    id: "reportsClasses",
    path: "/dashboard/reports",
    target: '[data-tour="reports-classes"]',
    screen: "reports",
    titleKey: "tour.step.reportsClasses.title",
    bodyKey: "tour.step.reportsClasses.body",
  },

  {
    id: "assignmentsStudents",
    path: "/dashboard/assignments",
    target: '[data-tour="assignments-students"]',
    screen: "assignments",
    titleKey: "tour.step.assignmentsStudents.title",
    bodyKey: "tour.step.assignmentsStudents.body",
  },
  {
    id: "assignmentsImport",
    path: "/dashboard/assignments",
    target: '[data-tour="assignments-import"]',
    screen: "assignments",
    titleKey: "tour.step.assignmentsImport.title",
    bodyKey: "tour.step.assignmentsImport.body",
  },

  {
    id: "driversAdd",
    path: "/dashboard/drivers",
    target: '[data-tour="drivers-add"]',
    screen: "drivers",
    titleKey: "tour.step.driversAdd.title",
    bodyKey: "tour.step.driversAdd.body",
  },
  {
    id: "driversCodes",
    path: "/dashboard/drivers",
    target: '[data-tour="drivers-codes"]',
    screen: "drivers",
    titleKey: "tour.step.driversCodes.title",
    bodyKey: "tour.step.driversCodes.body",
  },

  {
    id: "operators",
    path: "/dashboard/operators",
    target: '[data-tour="operators-list"]',
    screen: "operators",
    titleKey: "tour.step.operators.title",
    bodyKey: "tour.step.operators.body",
  },

  {
    /* The close: the manual, and the door back to this tour. It stays on
       whatever screen the last step ended on — Help lives in the rail. */
    id: "guide",
    target: '[data-tour="replay"]',
    centredFallback: true,
    titleKey: "tour.step.guide.title",
    bodyKey: "tour.step.guide.body",
  },
];

/** The steps this reader could meet, before the DOM decides what is on screen. */
export function tourSteps(
  profile: UserProfile,
  mainDirector: boolean,
): TourStep[] {
  return TOUR_STEPS.filter(
    (step) => step.screen === undefined || canOpenScreen(profile, step.screen, mainDirector),
  );
}
