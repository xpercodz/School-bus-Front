import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/arc/button/button";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { DateRangePicker, type DateRange } from "@/components/arc/date-range-picker/date-range-picker";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PaginationBar } from "@/components/dashboard/PaginationBar";
import { useAutoLoadMore, usePageSlice } from "@/lib/use-page-slice";
import { useLocale } from "@/lib/i18n/context";
import {
  formatDayMonth,
  formatTime,
  statusKey,
  toLocaleDigits,
  translateDataLabel,
} from "@/lib/i18n/format";
import { fromDateValue } from "@/lib/date-value";
import { Skeleton } from "@/components/Skeleton";
import { useBuses, useSchoolTeam, useStaffUsers } from "@/lib/school-admin";
import { useSchoolRoll } from "@/lib/school-data";
import { useActivityCounts, useActivityFeed, type ActivityRow } from "@/lib/school-audit";
import { EVENT_LABEL_KEY, type AuditChange, type AuditFamily } from "@/lib/audit";
import { buildActivityCsv, downloadCsv } from "@/lib/csv";

/**
 * The activity log — who changed what, and when.
 *
 * Reading order follows the question: the counts first (what happened at all),
 * then the stream, newest first. A busy school day writes hundreds of roll
 * transitions and a handful of account changes, so the strip is not decoration —
 * it is how the volume becomes navigable, and its numbers are exact.
 *
 * Every sentence is built here from the dictionary, in both languages. Nothing
 * user-facing is stored as prose, and no id or enum reaches the screen.
 */

const PAGE_SIZE = 10;

/** The window a director means by "recently", matching every log worth copying. */
const DEFAULT_DAYS = 7;

const DAY_MS = 86_400_000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function defaultRange(): DateRange {
  const today = startOfDay(new Date());
  return { start: new Date(today.getTime() - (DEFAULT_DAYS - 1) * DAY_MS), end: today };
}

/** `at` is commit time and `occurredAt` is the device's clock; they disagree offline. */
const SKEW_MS = 2 * 60_000;

export default function ActivityPage() {
  const { t, tp, locale } = useLocale();
  const { buses } = useBuses();
  const { students } = useSchoolRoll();
  const { team } = useSchoolTeam();
  const { staff } = useStaffUsers();

  const [range, setRange] = useState<DateRange>(defaultRange);
  const [family, setFamily] = useState<AuditFamily | null>(null);
  const [actorUid, setActorUid] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // The range picker's end day is inclusive; the query's is exclusive.
  const from = useMemo(() => startOfDay(range.start), [range]);
  const to = useMemo(() => new Date(startOfDay(range.end).getTime() + DAY_MS), [range]);

  const feed = useActivityFeed({ from, to, family, actorUid });
  const { counts } = useActivityCounts({ from, to, actorUid });

  const pages = usePageSlice(
    feed.rows,
    PAGE_SIZE,
    `${family ?? "all"}|${actorUid ?? "all"}|${from.getTime()}`,
  );
  useAutoLoadMore(pages, feed);

  const studentsById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students],
  );
  const busesById = useMemo(() => new Map(buses.map((bus) => [bus.id, bus])), [buses]);

  const digits = (value: string | number) => toLocaleDigits(String(value), locale);

  /** `formatDayMonth` reads the app's YYYY-MM-DD keys, so convert first. */
  const dayMonth = (date: Date) => formatDayMonth(fromDateValue(date), locale);

  const busLabel = (id: string | null | undefined): string => {
    if (!id) return t("activity.noBus");
    const bus = busesById.get(id);
    return bus ? translateDataLabel(bus.name, locale, t) : id;
  };

  const studentLabel = (id: string | null | undefined): string => {
    if (!id) return t("activity.removed");
    return studentsById.get(id)?.name ?? t("activity.removed");
  };

  const relative = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const formatter = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
      numeric: "auto",
    });
    if (diff < 60_000) return formatter.format(0, "minute");
    if (diff < 3_600_000) return formatter.format(-Math.round(diff / 60_000), "minute");
    if (diff < 86_400_000) return formatter.format(-Math.round(diff / 3_600_000), "hour");
    return formatter.format(-Math.round(diff / 86_400_000), "day");
  };

  const sentence = (row: ActivityRow): string => {
    const actor = row.actorName || t("activity.unknownActor");
    if (!row.event) {
      // An event this build does not know. Name the record, never the enum.
      return `${actor} — ${t("activity.unknownEvent")}`;
    }
    const changes = row.changes ?? {};
    const meta = row.meta ?? {};
    const vars: Record<string, string> = { actor };

    switch (row.event) {
      case "auth.sign_in_failed":
        vars.actor = row.actorName || row.targetName || t("activity.unknownActor");
        break;
      case "driver.created":
      case "driver.code_regenerated":
      case "operator.created":
      case "operator.screens_changed":
      case "operator.password_changed":
      case "operator.removed":
      case "owner.changed":
        vars.target = row.targetName || t("activity.unknownActor");
        break;
      case "student.bus_changed":
        vars.target = studentLabel(row.targetId);
        vars.from = busLabel(changes.busId?.from as string | null);
        vars.to = busLabel(changes.busId?.to as string | null);
        break;
      case "bus.driver_changed":
        vars.bus = busLabel(row.targetId);
        vars.driver = (changes.driver?.to as string | null) || t("activity.noDriver");
        break;
      case "attendance.changed":
        vars.target = studentLabel(row.targetId);
        vars.to = t(statusKey(String(changes.status?.to ?? "WAITING")));
        break;
      case "run.completed":
        vars.bus = busLabel((meta.busId as string) ?? null);
        return tp("activity.event.runCompleted", Number(meta.count ?? 0), {
          ...vars,
          count: digits(Number(meta.count ?? 0)),
        });
      case "run.dispatched":
        vars.bus = busLabel((meta.busId as string) ?? null);
        return tp("activity.event.runDispatched", Number(meta.count ?? 0), {
          ...vars,
          count: digits(Number(meta.count ?? 0)),
        });
      case "students.imported":
        return tp("activity.event.imported", Number(meta.count ?? 0), {
          ...vars,
          count: digits(Number(meta.count ?? 0)),
        });
      case "school.assignment_mode_changed":
        vars.to = t(
          changes.assignmentMode?.to === "driver" ? "activity.mode.driver" : "activity.mode.bus",
        );
        break;
      default:
        break;
    }

    return t(EVENT_LABEL_KEY[row.event], vars);
  };

  const fieldLabel = (field: string): string => {
    switch (field) {
      case "busId":
        return t("activity.field.busId");
      case "status":
        return t("activity.field.status");
      case "driver":
        return t("activity.field.driver");
      case "assignmentMode":
        return t("activity.field.assignmentMode");
      case "screens":
        return t("activity.field.screens");
      case "owner":
        return t("activity.field.owner");
      default:
        return field;
    }
  };

  const changeValue = (field: string, change: AuditChange, side: "from" | "to"): string => {
    const raw = change[side];
    if (raw === null || raw === undefined || raw === "") return t("activity.none");
    if (field === "busId") return busLabel(String(raw));
    if (field === "status") return t(statusKey(String(raw)));
    if (field === "assignmentMode") {
      return t(raw === "driver" ? "activity.mode.driver" : "activity.mode.bus");
    }
    if (field === "owner") return String(raw) === "true" ? t("activity.yes") : t("activity.no");
    return typeof raw === "string" ? translateDataLabel(raw, locale, t) : String(raw);
  };

  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const member of team) seen.set(member.uid, member.displayName);
    for (const member of staff) seen.set(member.uid, member.displayName);
    return [...seen.entries()]
      .map(([uid, name]) => ({ uid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [team, staff]);

  const total = counts ? counts.access + counts.student + counts.roll + counts.settings : null;
  const last = feed.rows[0]?.at ?? null;
  const failed = feed.rows.filter((row) => row.outcome === "failure").length;

  const finding =
    failed > 0
      ? tp("activity.finding.failed", failed, { count: digits(failed) })
      : total !== null
        ? tp("activity.finding.changes", total, {
            count: digits(total),
            when: last ? relative(last) : "—",
          })
        : null;

  const presetLabel = (days: number) =>
    days === 1 ? t("activity.preset.today") : tp("activity.preset.days", days, { count: digits(days) });

  function exportCsv() {
    const content = buildActivityCsv(
      feed.rows.map((row) => ({
        at: row.at,
        actor: row.actorName || t("activity.unknownActor"),
        outcome: row.outcome,
        source: row.source,
        sentence: sentence(row),
      })),
      {
        what: t("activity.col.what"),
        when: t("activity.col.when"),
        actor: t("activity.actorColumn"),
        outcome: t("activity.outcomeColumn"),
        source: t("activity.details.writtenBy"),
        success: t("activity.outcome.success"),
        failure: t("activity.outcome.failed"),
        sources: {
          api: t("activity.source.api"),
          client: t("activity.source.client"),
          system: t("activity.source.system"),
        },
        formatDate: (date) => `${dayMonth(date)} ${formatTime(date, locale)}`,
      },
    );
    downloadCsv(`activity-${fromDateValue(from)}.csv`, content);
  }

  const familyCells: Array<{ id: AuditFamily | null; label: string; count: number | null }> = [
    {
      id: null,
      label: t("activity.family.all"),
      count: total,
    },
    { id: "access", label: t("activity.family.access"), count: counts?.access ?? null },
    { id: "student", label: t("activity.family.student"), count: counts?.student ?? null },
    { id: "roll", label: t("activity.family.roll"), count: counts?.roll ?? null },
    { id: "settings", label: t("activity.family.settings"), count: counts?.settings ?? null },
  ];

  const actorLabel =
    actorUid === null
      ? t("activity.filter.actor")
      : (actorOptions.find((option) => option.uid === actorUid)?.name ?? t("activity.unknownActor"));

  return (
    <>
      <div className="border-b border-dash-outline-variant bg-dash-background px-4 pt-4 pb-3 sm:px-6 lg:pt-6">
        <div className="mx-auto w-full max-w-[1440px]">
          <PageHeader
            title={t("activity.title")}
            subtitle={t("activity.subtitle")}
            finding={finding ?? undefined}
            actions={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="arc-field"
                onClick={exportCsv}
                disabled={feed.rows.length === 0}
              >
                <Icon name="download" size={16} variant="outlined" />
                {t("activity.export")}
              </Button>
            }
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-4 sm:p-6">
        {/* The strip answers "what happened" before a page is turned, and its
            numbers are exact — a capped scan printed as a total would be a lie. */}
        <section
          aria-label={t("activity.family.aria")}
          data-page-reveal
          className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface"
        >
          <div className="grid grid-cols-2 divide-y divide-dash-outline-variant sm:grid-cols-5 sm:divide-y-0 sm:divide-x sm:[direction:ltr] rtl:sm:[direction:rtl]">
            {familyCells.map((cell) => {
              const selected = family === cell.id;
              return (
                <button
                  key={cell.id ?? "all"}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFamily(cell.id)}
                  className={`group flex flex-col gap-1 px-4 py-3 text-start transition-colors duration-150 ${
                    selected
                      ? "border-b-2 border-dash-primary bg-dash-primary-container/40"
                      : "border-b-2 border-transparent hover:bg-dash-surface-container-low"
                  }`}
                >
                  <span className="text-[11.5px] font-medium text-dash-on-surface-variant">
                    {cell.label}
                  </span>
                  <span
                    className={`text-[22px] leading-none font-semibold tabular-nums ${
                      selected ? "text-dash-primary" : "text-dash-on-surface"
                    }`}
                  >
                    {cell.count === null ? "—" : digits(cell.count)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Scope row: the dates, then the person. Both server-side. */}
        <div data-page-reveal className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            value={range}
            onChange={setRange}
            label={t("activity.filter.range")}
            locale={locale === "ar" ? "ar-EG" : "en-US"}
            presets={[
              { label: presetLabel(1), range: () => defaultRangeFor(1) },
              { label: presetLabel(7), range: () => defaultRangeFor(7) },
              { label: presetLabel(30), range: () => defaultRangeFor(30) },
              { label: presetLabel(90), range: () => defaultRangeFor(90) },
            ]}
          />

          <DropdownMenu
            ariaLabel={t("activity.filter.actorAria")}
            label={actorLabel}
            align="start"
            triggerClassName="arc-field"
            searchable={
              actorOptions.length >= 4
                ? {
                    placeholder: t("dropdown.searchPlaceholder"),
                    emptyLabel: t("dropdown.searchEmpty"),
                  }
                : undefined
            }
            items={[
              {
                label: t("activity.filter.actor"),
                checked: actorUid === null,
                onSelect: () => setActorUid(null),
              },
              ...actorOptions.map((option) => ({
                label: option.name,
                checked: actorUid === option.uid,
                onSelect: () => setActorUid(option.uid),
              })),
            ]}
          />

          {(family !== null || actorUid !== null) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFamily(null);
                setActorUid(null);
              }}
            >
              {t("activity.filter.clear")}
            </Button>
          )}
        </div>

        <section className="flex min-h-0 flex-col gap-3" data-page-reveal>
          {feed.error ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dash-outline-variant bg-dash-surface px-4 py-10">
              <p className="text-[15px] font-semibold text-dash-on-surface">
                {t("activity.error.title")}
              </p>
              <p className="max-w-prose text-[13px] leading-5 text-dash-on-surface-variant">
                {t("activity.error.body")}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="arc-field"
                onClick={() => setRange({ ...range })}
              >
                {t("activity.retry")}
              </Button>
            </div>
          ) : feed.loading && feed.rows.length === 0 ? (
            <div className="flex flex-col gap-2" role="status" aria-label={t("dashboard.loading")}>
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : feed.rows.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-lg border border-dash-outline-variant bg-dash-surface px-4 py-10">
              <p className="text-[15px] font-semibold text-dash-on-surface">
                {family !== null || actorUid !== null
                  ? t("activity.noMatch.title")
                  : t("activity.empty.title")}
              </p>
              <p className="max-w-prose text-[13px] leading-5 text-dash-on-surface-variant">
                {family !== null || actorUid !== null
                  ? t("activity.noMatch.body")
                  : t("activity.empty.body")}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="table-zebra w-full min-w-[560px] border-collapse text-start">
                  <thead className="border-b border-dash-outline-variant text-[11.5px] text-dash-on-surface-variant">
                    <tr>
                      <th scope="col" className="h-10 px-4 py-2 text-start font-medium">
                        {t("activity.col.what")}
                      </th>
                      <th
                        scope="col"
                        className="h-10 w-[132px] px-4 py-2 text-end font-medium whitespace-nowrap"
                      >
                        {t("activity.col.when")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-dash-body-sm text-dash-on-surface">
                    {pages.paged.map((row) => {
                      const open = expanded === row.id;
                      const skewed =
                        row.occurredAt !== null &&
                        row.at !== null &&
                        Math.abs(row.at.getTime() - row.occurredAt.getTime()) > SKEW_MS;
                      return (
                        <RowGroup
                          key={row.id}
                          row={row}
                          open={open}
                          skewed={skewed}
                          sentence={sentence(row)}
                          onToggle={() => setExpanded(open ? null : row.id)}
                          t={t}
                          formatDate={dayMonth}
                          formatClock={(date) => formatTime(date, locale)}
                          fieldLabel={fieldLabel}
                          changeValue={changeValue}
                          changes={row.changes ?? {}}
                          hasChanges={Object.keys(row.changes ?? {}).length > 0}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <PaginationBar pagination={pages} />
            </>
          )}
        </section>
      </div>
    </>
  );
}

interface RowGroupProps {
  row: ActivityRow;
  open: boolean;
  skewed: boolean;
  sentence: string;
  onToggle: () => void;
  t: ReturnType<typeof useLocale>["t"];
  formatDate: (date: Date) => string;
  formatClock: (date: Date) => string;
  fieldLabel: (field: string) => string;
  changeValue: (field: string, change: AuditChange, side: "from" | "to") => string;
  changes: Record<string, AuditChange>;
  hasChanges: boolean;
}

function RowGroup({
  row,
  open,
  skewed,
  sentence,
  onToggle,
  t,
  formatDate,
  formatClock,
  fieldLabel,
  changeValue,
  changes,
  hasChanges,
}: RowGroupProps) {
  return (
    <>
      <tr className={open ? "bg-dash-surface-container-low" : undefined}>
        <td className="px-4 py-3 align-top">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? t("activity.collapse") : t("activity.expand")}
            className="flex w-full items-start gap-3 text-start"
          >
            <Icon
              name="expand_more"
              size={18}
              variant="outlined"
              className={`mt-0.5 flex-none text-dash-on-surface-variant transition-transform duration-150 ${
                open ? "rotate-180" : ""
              }`}
            />
            <span className="min-w-0">
              <span className="text-dash-on-surface">{sentence}</span>
              {row.outcome === "failure" && (
                <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-dash-error-container px-2 py-0.5 align-middle text-[11px] font-medium text-dash-on-error-container">
                  {t("activity.outcome.failed")}
                </span>
              )}
            </span>
          </button>
        </td>
        <td className="px-4 py-3 text-end align-top whitespace-nowrap">
          <span className="tabular-nums text-dash-on-surface">
            {row.at ? formatClock(row.at) : "—"}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-dash-on-surface-variant">
            {row.at ? formatDate(row.at) : ""}
          </span>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={2} className="bg-dash-surface-container-low px-4 pb-4 pt-1">
            <div className="flex flex-col gap-4 sm:ms-8">
              {hasChanges ? (
                <table className="w-full max-w-md border-collapse text-start">
                  <thead>
                    <tr className="text-[11.5px] text-dash-on-surface-variant">
                      <th scope="col" className="py-1 text-start font-medium">
                        {t("activity.changes.field")}
                      </th>
                      <th scope="col" className="py-1 text-start font-medium">
                        {t("activity.changes.before")}
                      </th>
                      <th scope="col" className="py-1 text-start font-medium">
                        {t("activity.changes.after")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(changes).map(([field, change]) => (
                      <tr key={field} className="align-top">
                        <td className="py-1 pe-4 text-dash-on-surface-variant">
                          {fieldLabel(field)}
                        </td>
                        <td className="py-1 pe-4 text-dash-on-surface">
                          {changeValue(field, change, "from")}
                        </td>
                        <td className="py-1 text-dash-on-surface">
                          {changeValue(field, change, "to")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[12.5px] text-dash-on-surface-variant">
                  {t("activity.changes.none")}
                </p>
              )}

              <details className="text-[12px] text-dash-on-surface-variant">
                <summary className="cursor-pointer select-none">{t("activity.details.title")}</summary>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt>{t("activity.details.recorded")}</dt>
                  <dd className="tabular-nums">
                    {row.at ? `${formatDate(row.at)} · ${formatClock(row.at)}` : "—"}
                  </dd>
                  {skewed && row.occurredAt && (
                    <>
                      <dt>{t("activity.details.pressed")}</dt>
                      <dd className="tabular-nums">
                        {`${formatDate(row.occurredAt)} · ${formatClock(row.occurredAt)}`}
                      </dd>
                    </>
                  )}
                  <dt>{t("activity.details.writtenBy")}</dt>
                  <dd>
                    {row.source === "api"
                      ? t("activity.source.api")
                      : row.source === "system"
                        ? t("activity.source.system")
                        : t("activity.source.client")}
                  </dd>
                  <dt>{t("activity.details.entry")}</dt>
                  <dd className="tabular-nums break-all">{row.id}</dd>
                </dl>
              </details>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** A window of `days` ending today, for the preset rail. */
function defaultRangeFor(days: number): DateRange {
  const today = startOfDay(new Date());
  return { start: new Date(today.getTime() - (days - 1) * DAY_MS), end: today };
}
