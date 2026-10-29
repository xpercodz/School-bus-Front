import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Icon } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeSwitchButton } from "@/components/ThemeSwitchButton";
import { Dialog } from "@/components/Dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/context";
import { staggerDelay } from "@/lib/motion";
import { useSignOut } from "@/lib/sign-out";
import { formatDate, formatDayMonth, toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";
import type { StudentStatus } from "@/data/students";

interface TopAppBarProps {
  runMeta: { busId: string; runType: string; date: string };
  runStatus: "IN_PROGRESS" | "COMPLETED";
  /** False when live mode has no run doc yet (shows "No run dispatched"). */
  runExists: boolean;
  /**
   * The run's students, in roster order. Their statuses become the manifest
   * rail under the bar — one tick per child, so a driver sees the whole run at
   * a glance without reading four counts.
   */
  students?: readonly { id: string; status: StudentStatus }[];
}

/** One hue per attendance state; the same marks as the roster pills. */
const RAIL_CLASS: Record<StudentStatus, string> = {
  BOARDED: "bg-success",
  WAITING: "bg-waiting",
  DROPPED_OFF: "bg-primary",
  ABSENT: "bg-error",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-[12.5px] text-on-surface-variant">{label}</dt>
      <dd className="text-[13px] font-medium text-on-surface">{value}</dd>
    </div>
  );
}

/**
 * Driver app bar: the bus and its run in two compact lines, the language toggle
 * and the overflow menu. No oversized two-line marketing title — the roster is
 * the screen.
 */
export function TopAppBar({ runMeta, runStatus, runExists, students }: TopAppBarProps) {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const signOut = useSignOut();

  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<"menu" | "details">("menu");
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const busNumber = runMeta.busId
    ? toLocaleDigits(runMeta.busId.replace(/^bus/, ""), locale)
    : null;
  const busLabel = runMeta.busId
    ? translateDataLabel(`Bus ${runMeta.busId.replace(/^bus/, "")}`, locale, t)
    : "—";
  // The mobile roster is always the morning run (see ROSTER_RUN_TYPE in
  // school-data), so repeating "Morning run" in the title only stole width
  // from the bus number on a phone. The run type stays in the details sheet.
  const title = busNumber
    ? t("mobile.appBarTitle", { bus: busNumber })
    : t("mobile.appBarTitleNoBus");

  const statusLabel = !runExists
    ? t("mobile.runNotStarted")
    : runStatus === "COMPLETED"
      ? t("mobile.runCompleted")
      : t("mobile.runInProgress");
  const statusDot = !runExists
    ? "bg-outline"
    : runStatus === "COMPLETED"
      ? "bg-success"
      : "bg-primary";

  function openMenu() {
    setView("menu");
    setMenuOpen(true);
  }

  async function handleSignOut() {
    setConfirmSignOut(false);
    setMenuOpen(false);
    await signOut();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant bg-surface">
      {/* iOS standalone / notch: the bar's own padding owns the safe area. */}
      <div className="h-[env(safe-area-inset-top)]" aria-hidden="true" />
      <div className="flex min-h-14 items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-surface-container text-on-surface">
            <Icon name="directions_bus" size={20} />
          </span>
          <div className="min-w-0">
            <h1
              className="truncate text-[16px] font-semibold leading-5 text-on-surface"
              title={title}
            >
              {title}
            </h1>
            <p className="flex min-w-0 items-center gap-1.5 text-[11.5px] leading-4 text-on-surface-variant">
              <span className={`h-1.5 w-1.5 flex-none rounded-full ${statusDot}`} aria-hidden="true" />
              <span className="truncate">{statusLabel}</span>
              {/* The date is the first thing to give up its width on a 320px
                  phone; the status must stay readable. It remains available in
                  the run-details sheet. */}
              <span aria-hidden="true" className="hidden flex-none min-[380px]:inline">·</span>
              <span className="hidden flex-none min-[380px]:inline">
                {formatDayMonth(runMeta.date, locale)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-0.5">
          <ThemeSwitchButton iconOnly />
          <LanguageToggle />
          <Button
            type="button"
            variant="ghost"
            size="md"
            icon
            aria-label={t("mobile.moreOptionsAria")}
            onClick={openMenu}
          >
            <Icon name="more_vert" size={22} />
          </Button>
        </div>
      </div>

      {/* The run manifest: one tick per student, in roster order. It is the
          signature mobile element and it costs one line — the summary strip
          below still carries the counts and their labels. Decorative here:
          every count is announced by the summary section. */}
      {students && students.length > 0 && (
        <div
          className="flex items-center gap-px px-4 pb-2"
          aria-hidden="true"
          data-run-rail
        >
          {students.map((student, index) => (
            <span
              key={student.id}
              className={`grow-x h-1 min-w-[2px] flex-1 rounded-full ${RAIL_CLASS[student.status]} transition-colors duration-[var(--t-ui)]`}
              style={{ animationDelay: `${staggerDelay(index, students.length)}ms` }}
            />
          ))}
        </div>
      )}

      <Dialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t("mobile.moreOptionsAria")}
        placement="bottom"
      >
        {view === "menu" ? (
          <div className="flex flex-col gap-0.5 p-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              align="start"
              className="w-full"
              onClick={() => setView("details")}
            >
              <Icon name="info" size={20} />
              {t("runDetails.title")}
            </Button>
            {user && (
              <Button
                type="button"
                variant="danger"
                size="md"
                align="start"
                className="arc-field w-full"
                onClick={() => setConfirmSignOut(true)}
              >
                <Icon name="logout" size={20} />
                {t("settings.signOut")}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-on-surface">{t("runDetails.title")}</h2>
              <Button
                type="button"
                variant="ghost"
                size="md"
                icon
                onClick={() => setView("menu")}
                aria-label={t("dialog.close")}
              >
                <Icon name="arrow_back" size={20} />
              </Button>
            </div>
            <dl className="divide-y divide-outline-variant">
              <DetailRow label={t("runDetails.bus")} value={busLabel} />
              <DetailRow
                label={t("runDetails.type")}
                value={t(
                  runMeta.runType === "afternoon"
                    ? "runType.afternoonDropoff"
                    : "runType.morningPickup",
                )}
              />
              <DetailRow label={t("runDetails.date")} value={formatDate(runMeta.date, locale)} />
              <DetailRow label={t("runDetails.status")} value={statusLabel} />
            </dl>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmSignOut}
        title={t("confirm.signOut.title")}
        body={t("confirm.signOut.body")}
        confirmLabel={t("dialog.confirm")}
        cancelLabel={t("dialog.cancel")}
        onConfirm={handleSignOut}
        onClose={() => setConfirmSignOut(false)}
      />
    </header>
  );
}
