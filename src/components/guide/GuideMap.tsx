/**
 * THE DRAWING ON A GUIDEBOOK PAGE: a miniature of that screen, with one pin per
 * step beside it.
 *
 * ⚠️ IT IS DRAWN, NOT CAPTURED. A stored screenshot goes stale the day a control
 * moves, cannot follow the theme or the language, and would have to be re-taken
 * for every role. This is markup in the app's own tokens, so it ages with the
 * code, flips with `.dark`, and mirrors in Arabic.
 *
 * ⚠️ A PIN LIVES ON THE CONTROL IT NAMES. `<Pin n>` is rendered INSIDE the
 * element it points at, so a pin cannot name something the drawing does not
 * contain; the numbered steps in the article carry the same numbers. That is the
 * whole contract between the two halves of the page.
 *
 * The stage is `aria-hidden`: it restates the steps in pictures, and a screen
 * reader should hear the steps, not "14 slash 18 Bus 04". The caption below it
 * is real text.
 */
import type { ReactNode } from "react";
import { DASH_STATUS_META } from "@/data/dashboard";
import { SCREEN_LABEL_KEY } from "@/lib/permissions";
import type { GuideMapId } from "@/lib/guide";
import { useLocale } from "@/lib/i18n/context";

/** The number on the control. */
function Pin({ n }: { n: number }) {
  return (
    <span
      className="absolute -top-2 -start-2 z-10 grid size-[18px] place-items-center rounded-full bg-dash-primary text-[10px] font-semibold leading-none text-dash-on-primary ring-2 ring-dash-surface"
      aria-hidden="true"
    >
      {n}
    </span>
  );
}

/** Wraps the element a pin sits on (the pin is positioned to its top-start). */
function On({
  pin,
  children,
  className,
}: {
  pin?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      {pin === undefined ? null : <Pin n={pin} />}
      {children}
    </div>
  );
}

/** One card of the miniature. */
function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-md border border-dash-outline-variant bg-dash-surface ${
        className ?? ""
      }`}
    >
      {children}
    </div>
  );
}

/** A control-shaped chip, for toolbars. */
function Chip({
  children,
  quiet = false,
  className,
}: {
  children: ReactNode;
  quiet?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-[5px] border px-2 text-[11px] leading-none whitespace-nowrap ${
        quiet
          ? "border-dash-outline-variant bg-dash-surface text-dash-on-surface-variant"
          : "border-dash-outline-variant bg-dash-surface font-medium text-dash-on-surface"
      } ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

/** The status chip, in the dashboard's own tint. */
function StatusChip({ status }: { status: "BOARDED" | "DROPPED_OFF" | "ABSENT" | "WAITING" }) {
  const { t } = useLocale();
  return (
    <span
      className={`inline-flex h-5 items-center rounded-[4px] px-1.5 text-[10px] font-medium leading-none whitespace-nowrap ${
        DASH_STATUS_META[status]
      }`}
    >
      {t(
        status === "BOARDED"
          ? "status.boarded"
          : status === "DROPPED_OFF"
            ? "status.droppedOff"
            : status === "ABSENT"
              ? "status.absent"
              : "status.waiting",
      )}
    </span>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-medium text-dash-on-surface-variant">{children}</span>
  );
}

/** LIVE MONITOR */
function LiveMap() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-2.5">
      <On pin={1}>
        <Card className="px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] text-dash-on-surface-variant">
              {t("dashboard.accountedLabel")}
            </span>
            <span className="text-[15px] font-semibold leading-none tabular-nums text-dash-on-surface">
              14
              <span className="text-[11px] font-normal text-dash-on-surface-variant"> / 18</span>
            </span>
          </div>
          <div className="mt-2 flex h-1.5 gap-0.5" aria-hidden="true">
            <span className="h-full flex-[7] rounded-full bg-dash-success" />
            <span className="h-full flex-[5] rounded-full bg-dash-primary" />
            <span className="h-full flex-[3] rounded-full bg-dash-surface-container-high" />
            <span className="h-full flex-[3] rounded-full bg-dash-error" />
          </div>
        </Card>
      </On>

      <Card className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <On pin={2}>
            <span className="text-[12px] font-semibold text-dash-on-surface">Bus 04</span>
          </On>
          <On pin={3}>
            <span className="inline-flex items-center gap-1 text-[10px] text-dash-on-surface-variant">
              <span className="size-1.5 rounded-full bg-dash-primary" aria-hidden="true" />
              {t("dashboard.inProgress")}
            </span>
          </On>
        </div>
        <div className="mt-1.5 h-1 w-full rounded-full bg-dash-surface-container-high">
          <span className="block h-full w-[62%] rounded-full bg-dash-primary" />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-dash-on-surface-variant">
          <span>
            <b className="font-semibold text-dash-on-surface">4</b> {t("dashboard.in")}
          </span>
          <span>
            <b className="font-semibold text-dash-on-surface">2</b> {t("dashboard.out")}
          </span>
          <span>
            <b className="font-semibold text-dash-on-surface">1</b> {t("status.absent")}
          </span>
        </div>
      </Card>
    </div>
  );
}

/** STUDENTS */
function StudentsMap() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <On pin={1}>
          <Chip>
            {t("dashboard.today")}
            <span className="text-dash-on-surface-variant">▾</span>
          </Chip>
        </On>
        <Chip quiet>{t("studentList.searchPlaceholder")}</Chip>
      </div>

      <Card className="px-3 py-2.5">
        <div className="grid grid-cols-[1.4fr_0.6fr_0.9fr] items-center gap-x-2">
          <Th>{t("dashboard.th.studentName")}</Th>
          <Th>{t("dashboard.th.grade")}</Th>
          <On pin={2}>
            <Th>{t("dashboard.th.morningBoarded")}</Th>
          </On>
        </div>
        <div className="mt-1.5 flex flex-col gap-1.5 border-t border-dash-outline-variant pt-1.5">
          <div className="grid grid-cols-[1.4fr_0.6fr_0.9fr] items-center gap-x-2">
            <span className="truncate text-[11px] font-medium text-dash-on-surface">Amelia T.</span>
            <span className="text-[11px] text-dash-on-surface-variant">4B</span>
            <span className="text-[11px] tabular-nums text-dash-on-surface-variant">7:12</span>
          </div>
          <div className="grid grid-cols-[1.4fr_0.6fr_0.9fr] items-center gap-x-2">
            <span className="truncate text-[11px] font-medium text-dash-on-surface">Liam C.</span>
            <span className="text-[11px] text-dash-on-surface-variant">3C</span>
            <span className="text-[11px] tabular-nums text-dash-on-surface-variant">7:18</span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-dash-outline-variant pt-2">
          <StatusChip status="BOARDED" />
          <On pin={3}>
            <span className="text-[10px] text-dash-on-surface-variant">
              {t("dashboard.th.actions")}
            </span>
          </On>
        </div>
      </Card>
    </div>
  );
}

/** REPORTS */
function ReportsMap() {
  const { t } = useLocale();
  const classes = [
    ["4A", "18", "92%"],
    ["4B", "16", "88%"],
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <On pin={1} className="w-fit">
        <div className="flex items-center gap-1.5">
          <Chip>
            {t("dashboard.today")}
            <span className="text-dash-on-surface-variant">▾</span>
          </Chip>
          <Chip quiet>{t("runType.morningPickup")}</Chip>
        </div>
      </On>

      <div className="grid grid-cols-2 gap-2">
        {classes.map(([name, count, rate], index) => (
          <On key={name} pin={index === 0 ? 2 : undefined}>
            <Card className={`px-2.5 py-2 ${index === 0 ? "" : "opacity-90"}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-semibold text-dash-on-surface">{name}</span>
                <span className="text-[11px] font-semibold tabular-nums text-dash-on-surface">
                  {rate}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-dash-on-surface-variant">
                {count} {t("analytics.studentsUnit")}
              </p>
            </Card>
          </On>
        ))}
      </div>

      <On pin={3} className="w-fit">
        <Chip>{t("reports.analytics")}</Chip>
      </On>
    </div>
  );
}

/** ASSIGNMENTS */
function AssignmentsMap() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-2.5">
      <On pin={1}>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip quiet>{t("studentList.searchPlaceholder")}</Chip>
          <Chip>
            {t("assignments.allBuses")}
            <span className="text-dash-on-surface-variant">▾</span>
          </Chip>
          <Chip>
            {t("studentList.allGrades")}
            <span className="text-dash-on-surface-variant">▾</span>
          </Chip>
        </div>
      </On>

      <Card className="divide-y divide-dash-outline-variant">
        <div className="grid grid-cols-[1.4fr_0.6fr_1fr] items-center gap-x-2 px-3 py-2">
          <span className="truncate text-[11px] font-medium text-dash-on-surface">Amelia T.</span>
          <span className="text-[11px] text-dash-on-surface-variant">4B</span>
          <On pin={2}>
            <Chip className="w-full justify-between">
              Bus 04
              <span className="text-dash-on-surface-variant">▾</span>
            </Chip>
          </On>
        </div>
        <div className="grid grid-cols-[1.4fr_0.6fr_1fr] items-center gap-x-2 px-3 py-2">
          <span className="truncate text-[11px] font-medium text-dash-on-surface">Noah B.</span>
          <span className="text-[11px] text-dash-on-surface-variant">5A</span>
          <Chip className="w-full justify-between">
            Bus 07
            <span className="text-dash-on-surface-variant">▾</span>
          </Chip>
        </div>
      </Card>

      <On pin={3} className="w-fit">
        <Chip>{t("guide.assignments.import")}</Chip>
      </On>
    </div>
  );
}

/** DRIVERS */
function DriversMap() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-2.5">
      <On pin={1} className="w-fit">
        <Chip className="font-medium">{t("drivers.addTitle")}</Chip>
      </On>

      <Card className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-dash-on-surface">Rita P.</p>
            <p className="text-[10px] text-dash-on-surface-variant">Bus 04</p>
          </div>
          <On pin={2}>
            <Chip>{t("drivers.generateCode")}</Chip>
          </On>
        </div>

        <On pin={3} className="mt-2 block">
          <div className="flex items-center justify-between gap-2 rounded-[5px] bg-dash-surface-container px-2 py-1.5">
            <span className="text-[13px] font-semibold tracking-[0.18em] tabular-nums text-dash-on-surface">
              482915
            </span>
            <span className="text-[10px] text-dash-on-surface-variant">
              {t("drivers.codeOnceHint")}
            </span>
          </div>
        </On>
      </Card>
    </div>
  );
}

/** OPERATORS */
function OperatorsMap() {
  const { t } = useLocale();
  const screens = ["live", "students", "reports", "assignments", "drivers"] as const;
  return (
    <div className="flex flex-col gap-2.5">
      <On pin={1} className="w-fit">
        <Chip className="font-medium">{t("operators.create")}</Chip>
      </On>

      <Card className="px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[11px] font-semibold text-dash-on-surface">Mona F.</p>
          <p className="truncate text-[10px] text-dash-on-surface-variant">mona@school.edu</p>
        </div>
        <On pin={2} className="mt-2 block">
          <div className="flex flex-wrap gap-1">
            {screens.map((screen, index) => (
              <span
                key={screen}
                className={`inline-flex h-5 items-center gap-1 rounded-[4px] border px-1.5 text-[10px] leading-none ${
                  index < 3
                    ? "border-dash-primary/40 bg-dash-primary-container text-dash-on-primary-container"
                    : "border-dash-outline-variant bg-dash-surface text-dash-on-surface-variant"
                }`}
              >
                <span aria-hidden="true">{index < 3 ? "✓" : "·"}</span>
                {t(SCREEN_LABEL_KEY[screen])}
              </span>
            ))}
          </div>
        </On>
        <On pin={3} className="mt-2 block w-fit">
          <Chip className="font-medium">{t("operators.save")}</Chip>
        </On>
      </Card>
    </div>
  );
}

/** STATUS LEGEND */
function LegendMap() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-2.5">
      <Card className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          <On pin={1} className="inline-block">
            <StatusChip status="BOARDED" />
          </On>
          <StatusChip status="DROPPED_OFF" />
          <StatusChip status="ABSENT" />
          <On pin={3} className="inline-block">
            <span className="inline-flex h-5 items-center rounded-[4px] border border-dash-outline-variant bg-dash-surface px-1.5 text-[10px] leading-none text-dash-on-surface-variant">
              {t("status.waiting")}
            </span>
          </On>
        </div>
      </Card>

      <Card className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-dash-on-surface-variant">
            {t("guide.students.w2.term")}
          </span>
          <On pin={2}>
            <span className="flex items-center gap-1 text-[11px] font-semibold tabular-nums text-dash-on-surface">
              <span className="grid size-5 place-items-center rounded-full bg-dash-secondary-container">
                1
              </span>
              <span className="grid size-5 place-items-center rounded-full bg-dash-secondary-container">
                2
              </span>
              <span className="grid size-5 place-items-center rounded-full bg-dash-secondary-container">
                3
              </span>
            </span>
          </On>
        </div>
      </Card>
    </div>
  );
}


function ActivityMap() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-2.5">
      <On pin={1}>
        <div className="grid grid-cols-5 overflow-hidden rounded-[6px] border border-dash-outline-variant bg-dash-surface">
          {[
            t("activity.family.all"),
            t("activity.family.access"),
            t("activity.family.student"),
            t("activity.family.roll"),
            t("activity.family.settings"),
          ].map((label, index) => (
            <div
              key={label}
              className={`flex flex-col gap-0.5 px-1.5 py-1.5 ${
                index === 0 ? "border-b-2 border-dash-primary" : "border-b-2 border-transparent"
              }`}
            >
              <span className="truncate text-[8px] text-dash-on-surface-variant">{label}</span>
              <span
                className={`text-[12px] font-semibold tabular-nums ${
                  index === 0 ? "text-dash-primary" : "text-dash-on-surface"
                }`}
              >
                {["312", "9", "4", "296", "3"][index]}
              </span>
            </div>
          ))}
        </div>
      </On>

      <Card className="px-3 py-2.5">
        <On pin={2} className="block">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-[10.5px] leading-4 text-dash-on-surface">
              {t("guide.activity.miniRow1")}
            </p>
            <span className="flex-none text-[10px] tabular-nums text-dash-on-surface-variant">
              07:42
            </span>
          </div>
        </On>
        <On pin={3} className="mt-2 block">
          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 rounded-[5px] bg-dash-surface-container px-2 py-1.5 text-[9.5px] text-dash-on-surface-variant">
            <span>{t("activity.changes.field")}</span>
            <span>{t("activity.changes.before")}</span>
            <span>{t("activity.changes.after")}</span>
            <span className="text-dash-on-surface">{t("activity.field.busId")}</span>
            <span className="text-dash-on-surface">{t("guide.activity.miniFrom")}</span>
            <span className="text-dash-on-surface">{t("guide.activity.miniTo")}</span>
          </div>
        </On>
      </Card>
    </div>
  );
}

const MAPS: Record<GuideMapId, () => ReactNode> = {
  live: LiveMap,
  students: StudentsMap,
  reports: ReportsMap,
  assignments: AssignmentsMap,
  drivers: DriversMap,
  operators: OperatorsMap,
  activity: ActivityMap,
  legend: LegendMap,
};

export function GuideMap({ map, caption }: { map: GuideMapId; caption: string }) {
  const Drawing = MAPS[map];
  return (
    <figure className="m-0">
      <div
        aria-hidden="true"
        className="rounded-lg border border-dash-outline-variant bg-dash-background p-4 sm:p-5"
      >
        <Drawing />
      </div>
      <figcaption className="mt-2 text-[12px] leading-5 text-dash-on-surface-variant">
        {caption}
      </figcaption>
    </figure>
  );
}
