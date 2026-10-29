import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/lib/theme-context";
import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { OtpInput } from "@/components/arc/otp-input/otp-input";
import { ExpandingSearch } from "@/components/arc/expanding-search/expanding-search";
import { BarChart } from "@/components/arc/bar-chart/bar-chart";
import { DonutChart } from "@/components/arc/donut-chart/donut-chart";
import { SlopeChart } from "@/components/arc/slope-chart/slope-chart";
import {
  DateRangePicker,
  defaultDateRangePresets,
  type DateRange,
  type DateRangePreset,
} from "@/components/arc/date-range-picker/date-range-picker";
import { UserMenu } from "@/components/arc/user-menu/user-menu";

/*
  ── Component review page (temporary) ───────────────────────────────────────
  Not linked from anywhere and not part of the app's flow: `/preview` renders
  the seven Arc components in the real token system, both themes and both text
  directions, so the changes can be judged before they are wired into
  LoginPage / ReportsPage / AssignmentsPage. Delete this file and its route once
  the design is accepted.

  Numbers come from the seeded demo school (schools/demo-academy), captured
  2026-09-02. Where a chart needs a second point in time the caption says so
  rather than inventing one.
*/

// ── real demo-school numbers (attendance docs, 2026-09-02, morning run) ──────

const STATUS_MIX = [
  { key: "boarded", label: "Boarded", value: 18 },
  { key: "droppedOff", label: "Dropped off", value: 7 },
  { key: "absent", label: "Absent", value: 2 },
  { key: "waiting", label: "Waiting", value: 5 },
];

const BY_BUS = [
  { key: "bus01", label: "Bus 01", axisLabel: "6 of 8", value: 6 },
  { key: "bus02", label: "Bus 02", axisLabel: "5 of 6", value: 5 },
  { key: "bus03", label: "Bus 03", axisLabel: "5 of 6", value: 5 },
  { key: "bus04", label: "Bus 04", axisLabel: "9 of 12", value: 9 },
];

/**
 * Sample series, NOT the demo school: both seeded days carry identical per-bus
 * ratios, so a real slope chart is four flat lines stacked on top of each other
 * — unreadable, and it hides what the chart is for. These numbers show the
 * design with movement in it; the caption says so.
 */
const SLOPE_SAMPLE = [
  { key: "bus01", label: "Bus 01", start: 62, end: 75 },
  { key: "bus02", label: "Bus 02", start: 90, end: 83 },
  { key: "bus03", label: "Bus 03", start: 78, end: 83 },
  { key: "bus04", label: "Bus 04", start: 70, end: 75 },
];

const SEARCH_ITEMS = [
  { id: "s1", title: "Amal Haddad", meta: "Grade 4 · Bus 02", group: "Students" },
  { id: "s2", title: "Bilal Nassar", meta: "Grade 2 · Bus 01", group: "Students" },
  { id: "s3", title: "Dina Khoury", meta: "Grade 6 · Bus 04", group: "Students" },
  { id: "s4", title: "Hassan Rifai", meta: "Grade 3 · Bus 03", group: "Students" },
  { id: "s5", title: "Lina Ayoub", meta: "Grade 5 · Bus 02", group: "Students" },
  { id: "s6", title: "Omar Saleh", meta: "Grade 1 · Bus 01", group: "Students" },
  { id: "b1", title: "Bus 01", meta: "8 students · Nour Saab", group: "Buses" },
  { id: "b2", title: "Bus 02", meta: "6 students · Karim Hilal", group: "Buses" },
  { id: "b3", title: "Bus 03", meta: "6 students · Sami Toufic", group: "Buses" },
  { id: "b4", title: "Bus 04", meta: "12 students · Rana Matar", group: "Buses" },
];

const BUSES = Array.from({ length: 12 }, (_, i) => `Bus ${String(i + 1).padStart(2, "0")}`);

// ── page ────────────────────────────────────────────────────────────────────

export default function PreviewPage() {
  const { resolved, setMode } = useTheme();
  const [rtl, setRtl] = useState(false);

  // `?dir=rtl` and `?theme=dark` exist so the review page can be screenshotted
  // deterministically at a fixed direction and theme.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("dir") === "rtl") setRtl(true);
    const theme = params.get("theme");
    if (theme === "dark" || theme === "light") setMode(theme);
    // setMode is stable; the effect is intentionally run-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Portalled menus render into <body>, outside any wrapper — the direction has
  // to be set on the document or RTL popovers would anchor to the wrong edge.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dir;
    root.dir = rtl ? "rtl" : "ltr";
    root.lang = rtl ? "ar" : "en";
    return () => {
      root.dir = previous;
      root.lang = "en";
    };
  }, [rtl]);

  return (
    <div className="min-h-dvh bg-surface px-4 pb-24 pt-6 sm:px-8">
      <header className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 border-b border-outline-variant pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-on-surface-variant">Temporary route · not linked, not shipped</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-[1.1] tracking-[-0.01em] text-on-surface">
            Seven component changes, in the real palette
          </h1>
          <p className="mt-2 max-w-[62ch] text-[14px] leading-6 text-on-surface-variant">
            Every widget below is the registry component itself, with its tokens mapped onto ours
            (<code className="text-[13px] text-on-surface">components/arc/arc-tokens.css</code>) — not a mock-up.
            Charts use the demo school&apos;s attendance documents.
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <div className="flex h-11 items-center rounded-lg border border-control-outline bg-surface-container-lowest p-0.5">
            {[
              { id: "ltr", label: "English" },
              { id: "rtl", label: "العربية" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRtl(option.id === "rtl")}
                aria-pressed={(option.id === "rtl") === rtl}
                className={`press h-10 rounded-md px-3 text-[13px] ${
                  (option.id === "rtl") === rtl
                    ? "bg-primary-container font-medium text-on-primary-container"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <ThemeSwitch
            theme={resolved}
            variant="reveal"
            onThemeChange={(next) => setMode(next)}
            label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
          />
        </div>
      </header>

      <main className="mx-auto mt-8 flex w-full max-w-[1180px] flex-col gap-14">
        <ThemeBlock />
        <DropdownBlock />
        <OtpBlock />
        <SearchBlock />
        <ChartsBlock />
        <DateRangeBlock />
        <UserMenuBlock />
        <VerdictBlock />
      </main>
    </div>
  );
}

// ── shared frame ────────────────────────────────────────────────────────────

function Block({
  n,
  title,
  where,
  id,
  children,
}: {
  n: string;
  title: string;
  where: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
        <h2 className="flex items-baseline gap-2 text-[17px] font-semibold text-on-surface">
          <span className="text-on-surface-variant">{n}</span>
          <span>{title}</span>
        </h2>
        <p className="text-[13px] text-on-surface-variant">{where}</p>
      </div>
      {children}
    </section>
  );
}

function Slice({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] leading-5 text-on-surface-variant">{children}</p>;
}

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[390px] max-w-full rounded-3xl border border-outline-variant bg-surface-container-lowest p-3">
      {children}
    </div>
  );
}

// ── 01 theme switch ─────────────────────────────────────────────────────────

function ThemeBlock() {
  const { resolved, setMode } = useTheme();
  const variants = ["reveal", "eclipse", "split", "rise"] as const;

  return (
    <Block id="block-01" n="01" title="Theme switch" where="every header and the rail footer">
      <Slice>
        <div className="flex flex-col gap-5">
          {/* the real context: director phone header, icon-only */}
          <div className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant">
                <Icon name="menu" size={22} variant="outlined" />
              </span>
              <p className="truncate text-[13.5px] font-semibold text-on-surface">Demo Academy</p>
            </div>
            <div className="flex items-center gap-1">
              <ThemeSwitch
                theme={resolved}
                variant="reveal"
                iconOnly
                onThemeChange={(next) => setMode(next)}
                label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
              />
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant"
              >
                <Icon name="translate" size={22} variant="outlined" />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {variants.map((variant) => (
              <div key={variant} className="flex flex-col gap-2">
                <ThemeSwitch
                  theme={resolved}
                  variant={variant}
                  onThemeChange={(next, kind, trigger) => setMode(next, { trigger, flip: kind })}
                  label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
                />
                <span className="text-[11.5px] text-on-surface-variant">
                  variant=&quot;{variant}&quot;
                </span>
              </div>
            ))}
          </div>

          <Caption>
            Each variant is the same trick in a different clip: a circle out of the switch, a circle
            out of the middle of the screen, a column that opens sideways, a band that lifts. It is
            ported from the report app&apos;s flip (<code className="text-[12px]">beginThemeFlip</code> + the
            <code className="text-[12px]">::view-transition</code> keyframes), and the app itself ships only
            <code className="text-[12px]">reveal</code> — the one that starts where the person pressed.
          </Caption>
        </div>
      </Slice>
    </Block>
  );
}

// ── 02 dropdown menu ────────────────────────────────────────────────────────

function DropdownBlock() {
  const [bus, setBus] = useState("All buses");
  const [grade, setGrade] = useState("All grades");
  const [lastAction, setLastAction] = useState<string | null>(null);

  return (
    <Block id="block-02" n="02" title="Dropdown menu" where="the six value selectors + the Reports action menu">
      <Slice>
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu
              label={bus}
              items={[
                { label: "All buses", onSelect: () => setBus("All buses") },
                ...BUSES.map((name) => ({ label: name, onSelect: () => setBus(name) })),
              ]}
            />
            <DropdownMenu
              label={grade}
              items={[
                { label: "All grades", onSelect: () => setGrade("All grades") },
                ...["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"].map((name) => ({
                  label: name,
                  onSelect: () => setGrade(name),
                })),
              ]}
            />
            <span className="ms-1 text-[12.5px] text-on-surface-variant">
              a value selector: the trigger carries the current value
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-low p-3">
            <p className="me-auto text-[12.5px] text-on-surface-variant">
              Row actions (the Reports &quot;more&quot; disclosure today)
            </p>
            <DropdownMenu
              label="Actions"
              icon={<Icon name="more_vert" size={18} variant="outlined" />}
              items={[
                { label: "Open analytics", icon: <Icon name="insights" size={18} variant="outlined" />, onSelect: () => setLastAction("analytics") },
                { label: "Print report", icon: <Icon name="print" size={18} variant="outlined" />, onSelect: () => setLastAction("print") },
                { label: "Export CSV", icon: <Icon name="download" size={18} variant="outlined" />, onSelect: () => setLastAction("csv") },
                { label: "Re-verify code", icon: <Icon name="refresh" size={18} variant="outlined" />, separatorBefore: true, onSelect: () => setLastAction("rotate") },
                { label: "Remove driver", icon: <Icon name="logout" size={18} variant="outlined" />, destructive: true, onSelect: () => setLastAction("remove") },
              ]}
            />
            <span className="w-full text-[12px] text-on-surface-variant sm:w-auto">
              {lastAction ? `last action: ${lastAction}` : "no action yet"}
            </span>
          </div>

          <Caption>
            Icons are passed in as our own Material glyphs, so the tables keep one icon language; the
            chevron inside the trigger is the library&apos;s (lucide) and is the only stroke icon on
            screen. Long lists (12 buses) get a scrollable menu and type-ahead from Radix for free.
          </Caption>
        </div>
      </Slice>
    </Block>
  );
}

// ── 03 OTP ──────────────────────────────────────────────────────────────────

type OtpState = "idle" | "checking" | "verified" | "error";

/** The seal: filled ring, check drawn on top. Our own — the font subset has no `verified` glyph. */
function VerifiedSeal() {
  return (
    <span className="pop-in inline-flex items-center gap-2 rounded-full bg-success-container py-1 pe-3 ps-1">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-on-success">
        <Icon name="check" size={16} />
      </span>
      <span className="text-[12.5px] font-medium text-on-success-container">Code verified</span>
    </span>
  );
}

function OtpBlock() {
  // `?otp=246810` seeds the field so the verified / error states can be captured.
  const [code, setCode] = useState(
    () => new URLSearchParams(window.location.search).get("otp") ?? "",
  );
  const [state, setState] = useState<OtpState>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Auto-submit: the moment the sixth digit exists, verify — no button press.
  useEffect(() => {
    if (state === "verified" || state === "checking") return;
    if (code.length !== 6) {
      setError(undefined);
      return;
    }
    setState("checking");
    timer.current = window.setTimeout(() => {
      if (code === "000000") {
        setState("error");
        setError("That code isn't valid. Check it and try again.");
      } else {
        setState("verified");
        setError(undefined);
      }
    }, 700);
  }, [code, state]);

  function reset() {
    window.clearTimeout(timer.current);
    setCode("");
    setState("idle");
    setError(undefined);
  }

  return (
    <Block id="block-03" n="03" title="Driver access code" where="LoginPage · driver tab">
      <div className="grid gap-4 lg:grid-cols-2">
        <Slice>
          <div className="mx-auto flex w-full max-w-[380px] flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                <Icon name="directions_bus" size={20} />
              </span>
              <div>
                <p className="text-[15px] font-semibold leading-tight text-on-surface">Driver sign-in</p>
                <p className="text-[12.5px] text-on-surface-variant">Six digits from your director</p>
              </div>
              {state === "verified" && <span className="ms-auto"><VerifiedSeal /></span>}
            </div>

            <div className="arc-field">
            <OtpInput
              label="Access code"
              description="Type the 6-digit code — sign-in starts on the last digit."
              error={error}
              value={code}
              onChange={setCode}
              disabled={state === "verified" || state === "checking"}
            />
            </div>

            <div className="flex items-center gap-2 text-[12.5px] text-on-surface-variant" aria-live="polite">
              {state === "checking" && (
                <>
                  <Icon name="progress_activity" size={16} className="animate-spin" />
                  Checking…
                </>
              )}
              {state === "verified" && (
                <>
                  <Icon name="check" size={16} className="text-success" />
                  Signed in — redirecting to the roster.
                </>
              )}
              {state === "idle" && <span>{code.length} of 6 entered</span>}
              {state === "error" && <span className="text-error">Try 000000 to see the failure state.</span>}
            </div>

            {state === "verified" && (
              <button
                type="button"
                onClick={reset}
                className="press h-10 self-start rounded-md px-3 text-[13px] font-medium text-primary hover:bg-primary-container"
              >
                Reset the demo
              </button>
            )}
          </div>
        </Slice>

        <Slice className="flex flex-col gap-4">
          <Caption>
            Verified badge: a filled seal (success ground, check glyph) that pops in beside the card
            title the instant the code is accepted — before the redirect, so a slow network never
            looks like a rejected code.
          </Caption>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-container-low p-3">
            <VerifiedSeal />
            <span className="text-[12.5px] text-on-surface-variant">idle → checking → verified</span>
          </div>
          <Caption>
            What changes on LoginPage: the single `tracking-[0.35em]` input becomes six boxes; the
            existing lockout (5 fails → 15 min) and the Arabic-Indic digit normalisation both stay;
            the submit button disappears because the sixth digit submits. The server error codes
            (`invalid_code`, `too_many_attempts`, `rate_limited`) currently collapse into one message
            on the driver path — this component is where they can finally read differently.
          </Caption>
        </Slice>
      </div>
    </Block>
  );
}

// ── 04 expanding search ─────────────────────────────────────────────────────

function SearchBlock() {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <Block id="block-04" n="04" title="Expanding search" where="roster, dashboard toolbar, assignments">
      <Slice>
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-on-surface-variant">
              {picked ? `selected: ${picked}` : "click the magnifier, type “bus” or a student name"}
            </p>
            <div className="arc-field w-full sm:w-[340px]">
            <ExpandingSearch
              label="Search students and buses"
              placeholder="Search students and buses"
              items={SEARCH_ITEMS}
              suggestions={SEARCH_ITEMS.slice(0, 3)}
              suggestionsLabel="Recent"
              onSelect={(item) => setPicked(item.title)}
            />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Caption>Phone width, in the roster slot the plain input occupies today:</Caption>
            <Phone>
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-[13.5px] font-semibold text-on-surface">Passengers</p>
                <div className="arc-field w-[260px]">
                <ExpandingSearch
                  label="Search students"
                  placeholder="Search students"
                  items={SEARCH_ITEMS}
                  suggestions={SEARCH_ITEMS.slice(0, 4)}
                  expandedWidth={300}
                  onSelect={(item) => setPicked(item.title)}
                />
                </div>
              </div>
            </Phone>
          </div>

          <Caption>
            This is a behaviour change, not a reskin: today&apos;s search is a pinned input whose value
            filters the list as you type, and this one is a collapsed icon that expands over the
            content and offers suggestions. It has to keep a visible value once collapsed, or the
            roster loses the only feedback that a filter is active.
          </Caption>
        </div>
      </Slice>
    </Block>
  );
}

// ── 05 charts ───────────────────────────────────────────────────────────────

type ChartId = "bar" | "donut" | "slope";

function ChartsBlock() {
  // `?chart=donut` / `?chart=slope` so each chart can be captured on its own.
  const [chart, setChart] = useState<ChartId>(() => {
    const param = new URLSearchParams(window.location.search).get("chart");
    return param === "donut" || param === "slope" ? param : "bar";
  });
  const options = useMemo(
    () => [
      { id: "bar" as const, label: "Bar", hint: "volume by bus or day" },
      { id: "donut" as const, label: "Donut", hint: "status mix" },
      { id: "slope" as const, label: "Slope", hint: "change between two runs" },
    ],
    [],
  );

  return (
    <Block id="block-05" n="05" title="Reports charts" where="the Analytics modal's per-bus chart">
      <Slice>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-11 items-center rounded-lg border border-control-outline bg-surface-container-lowest p-0.5">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setChart(option.id)}
                  aria-pressed={chart === option.id}
                  className={`press h-10 rounded-md px-3 text-[13px] ${
                    chart === option.id
                      ? "bg-primary-container font-medium text-on-primary-container"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="text-[12.5px] text-on-surface-variant">
              {options.find((option) => option.id === chart)?.hint}
            </span>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
            {chart === "bar" && (
              <BarChart
                data={BY_BUS}
                label="Completed boardings by bus"
                period="2 Sep · morning run"
                unit="students"
                valueLabel="Completed"
                categoryLabel="Bus"
                averageLabel="Fleet average"
                showAverage
              />
            )}
            {chart === "donut" && (
              <DonutChart
                data={STATUS_MIX}
                label="Attendance mix"
                unit="students"
                totalLabel="On the run"
                legend
              />
            )}
            {chart === "slope" && (
              <SlopeChart
                data={SLOPE_SAMPLE}
                label="Completion per bus"
                startLabel="Last week"
                endLabel="This week"
                formatValue={(value) => `${value}%`}
                formatChange={(change) => `${change > 0 ? "+" : ""}${change} pts`}
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Caption>
              <strong className="text-on-surface">Data is real</strong> — the demo school&apos;s attendance
              documents for 2 Sep (32 rows: 18 boarded, 7 dropped off, 2 absent, 5 waiting). The slope
              chart is deliberately flat: both seeded days have identical per-bus ratios, which is
              exactly the problem with that chart in this product.
            </Caption>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                {
                  id: "bar",
                  verdict: "Keep",
                  tone: "text-success",
                  body: "Single series only — it draws one value per category. Fine for completed count per bus or per day, but it cannot show boarded vs absent side by side; that needs two charts or a derived %.",
                },
                {
                  id: "donut",
                  verdict: "Keep — strongest fit",
                  tone: "text-success",
                  body: "The only chart that needs zero new data: the four statuses already on the page, centre total = rows on the run. Same snapshot the tables use.",
                },
                {
                  id: "slope",
                  verdict: "Weak — needs a second point",
                  tone: "text-waiting",
                  body: "Only honest comparison today is morning vs afternoon of one day, or two date windows once the range picker exists. If neither is wired it is decoration — I would ship the other two first.",
                },
              ].map((item) => (
                <div key={item.id} className="rounded-lg bg-surface-container-low p-3">
                  <p className={`text-[12.5px] font-semibold ${item.tone}`}>{item.verdict}</p>
                  <p className="mt-1 text-[12px] leading-5 text-on-surface-variant">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Slice>
    </Block>
  );
}

// ── 06 date range ───────────────────────────────────────────────────────────

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const shift = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const mondayOf = (date: Date) => shift(dayStart(date), -(date.getDay() === 0 ? 6 : date.getDay() - 1));

const PRESETS: DateRangePreset[] = [
  { label: "Today", range: (today) => ({ start: today, end: today }) },
  { label: "Last 7 days", range: (today) => ({ start: shift(today, -6), end: today }) },
  { label: "This week", range: (today) => ({ start: mondayOf(today), end: today }) },
  {
    label: "Last week",
    range: (today) => ({ start: shift(mondayOf(today), -7), end: shift(mondayOf(today), -1) }),
  },
  { label: "Last 30 days", range: (today) => ({ start: shift(today, -29), end: today }) },
  { label: "This month", range: (today) => ({ start: new Date(today.getFullYear(), today.getMonth(), 1), end: today }) },
  ...defaultDateRangePresets.filter((preset) => preset.label === "Last month"),
];

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function DateRangeBlock() {
  const [range, setRange] = useState<DateRange | null>(() => ({ start: shift(new Date(), -6), end: new Date() }));
  const [locale, setLocale] = useState("en-US");

  const days = range
    ? Math.round((dayStart(range.end).getTime() - dayStart(range.start).getTime()) / 86_400_000) + 1
    : 0;

  return (
    <Block id="block-06" n="06" title="Date range" where="candidate, not adopted — the scope row keeps the single date chip">
      <Slice>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="arc-field">
            <DateRangePicker
              value={range}
              onChange={setRange}
              label="Reporting period"
              presets={PRESETS}
              locale={locale}
              maxDate={new Date()}
            />
            </div>
            <button
              type="button"
              onClick={() => setLocale((current) => (current === "en-US" ? "ar-EG" : "en-US"))}
              className="press h-10 rounded-md border border-control-outline px-3 text-[12.5px] text-on-surface-variant hover:text-on-surface"
            >
              calendar locale: {locale}
            </button>
          </div>

          <div className="rounded-lg bg-surface-container-low p-3">
            <p className="text-[12.5px] leading-6 text-on-surface-variant">
              reads as{" "}
              <code className="text-on-surface">
                {range ? `${iso(range.start)} → ${iso(range.end)}` : "no range"} · {days} days
              </code>{" "}
              → <code className="text-on-surface">useAttendanceTrend(start, end, segment)</code>, which
              already does a paged <code className="text-on-surface">date &gt;= from, date &lt;= to, orderBy date</code>{" "}
              query. No new composite index: a single-field range is automatic.
            </p>
          </div>

          <Caption>
            Presets are the ones this product actually needs (today, last 7 days, this week, last week,
            last 30 days, this month, last month) — the library ships day-based presets only, and no
            calendar-week one, so this list is ours. Every label here is hardcoded English in the
            library; they all need <code className="text-[12px]">t()</code> keys in en + ar. Kept as a
            reference: the multi-day trend that gave it a job was removed on 2026-10-29, so nothing in
            the app mounts this today. It is also the least RTL-safe component in the set (physical
            range band), which is part of why it was not adopted.
          </Caption>
        </div>
      </Slice>
    </Block>
  );
}

// ── 07 user menu ────────────────────────────────────────────────────────────

function UserMenuBlock() {
  const [status, setStatus] = useState<"available" | "busy" | "away">("available");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [signOutPressed, setSignOutPressed] = useState(false);

  return (
    <Block id="block-07" n="07" title="User menu" where="candidate, not adopted — the rail footer carries the account row">
      <Slice>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-2">
            <p className="text-[13.5px] font-semibold text-on-surface">Demo Academy</p>
            <UserMenu
              user={{ name: "Demo Director", email: "director@schoolbus.demo", plan: "Director" }}
              status={status}
              onStatusChange={setStatus}
              theme={theme}
              onThemeChange={setTheme}
              items={[
                { label: "School settings", icon: <Icon name="settings" size={16} variant="outlined" /> },
                { label: "Assignments", icon: <Icon name="add_link" size={16} variant="outlined" /> },
                { label: "Help", icon: <Icon name="help" size={16} variant="outlined" /> },
              ]}
              onSignOut={() => setSignOutPressed(true)}
              showName
            />
          </div>

          <Caption>
            {signOutPressed
              ? "sign-out fired — in the app this opens the existing ConfirmDialog first, then useSignOut()."
              : "Avatar falls back to initials: the profile has displayName/role/schoolId and Firebase email, and no photo, so avatarSrc is never passed."}
          </Caption>

          <Caption>
            &quot;Available / Busy / Away&quot; and the Light/Dark/System row are product vocabulary that
            does not exist here — a director does not set presence. Either the status row is dropped
            (prop-level change to the vendored component) or it is mapped onto something real.
          </Caption>
        </div>
      </Slice>
    </Block>
  );
}

// ── verdict ─────────────────────────────────────────────────────────────────

function VerdictBlock() {
  return (
    <Block id="block-08" n="—" title="What this costs, honestly" where="before wiring anything in">
      <Slice>
        <ul className="flex flex-col gap-3 text-[13.5px] leading-6 text-on-surface">
          <li>
            <strong>New dependencies:</strong>{" "}
            <code className="text-[13px]">motion</code> (~110 KiB min),{" "}
            <code className="text-[13px]">lucide-react</code> (tree-shaken, ~1–2 KiB per icon),{" "}
            <code className="text-[13px]">@radix-ui/react-dropdown-menu</code> (~30 KiB). The service
            worker precache is asserted at ~1.70 MiB by <code className="text-[13px]">npm run test:offline</code>,
            so that assertion needs re-baselining, not deleting.
          </li>
          <li>
            <strong>Two icon languages.</strong> These components draw their own chevrons, search glyph
            and calendar arrows with lucide (stroke), while the app is Material Symbols (filled/outline).
            I pass our glyphs wherever the API takes an icon node; the internal ones cannot be
            overridden without editing vendored files.
          </li>
          <li>
            <strong>Hardcoded English.</strong> Every default string in these components (presets,
            &quot;Total&quot;, &quot;Daily average&quot;, &quot;Sign out&quot;, &quot;digit N of 6&quot;,
            &quot;Switch to dark mode&quot;) violates the no-hardcoded-strings rule. Each is a prop or a
            small patch; the OTP digit label and the chart empty states are not props.
          </li>
          <li>
            <strong>Not verified yet:</strong> a screen-reader pass, the print stylesheet for charts
            (Reports prints), and RTL at 390px. The direction toggle above shows the geometry, not a11y.
          </li>
        </ul>
      </Slice>
    </Block>
  );
}
