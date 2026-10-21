import { useState } from "react";
import { Icon } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Dialog } from "@/components/Dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/context";
import { useSignOut } from "@/lib/sign-out";
import { formatDate, toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

interface TopAppBarProps {
  runMeta: { busId: string; runType: string; date: string };
  runStatus: "IN_PROGRESS" | "COMPLETED";
  /** False when live mode has no run doc yet (shows "No run dispatched"). */
  runExists: boolean;
}

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
export function TopAppBar({ runMeta, runStatus, runExists }: TopAppBarProps) {
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
  const title = busNumber
    ? `${t("mobile.appBarTitle", { bus: busNumber })} · ${t("mobile.runTitle")}`
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
      <div className="flex h-14 items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-surface-container text-on-surface">
            <Icon name="directions_bus" size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-semibold leading-5 text-on-surface">
              {title}
            </h1>
            <p className="flex items-center gap-1.5 truncate text-[11.5px] leading-4 text-on-surface-variant">
              <span className={`h-1.5 w-1.5 flex-none rounded-full ${statusDot}`} aria-hidden="true" />
              {statusLabel}
              <span aria-hidden="true">·</span>
              {formatDate(runMeta.date, locale)}
            </p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-0.5">
          <LanguageToggle />
          <button
            type="button"
            aria-label={t("mobile.moreOptionsAria")}
            onClick={openMenu}
            className="flex h-11 w-11 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="more_vert" size={22} />
          </button>
        </div>
      </div>

      <Dialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t("mobile.moreOptionsAria")}
        placement="bottom"
      >
        {view === "menu" ? (
          <div className="flex flex-col gap-0.5 p-2">
            <button
              type="button"
              onClick={() => setView("details")}
              className="flex h-12 items-center gap-3 rounded-md px-3 text-[14px] text-on-surface hover:bg-surface-container"
            >
              <Icon name="info" size={20} />
              {t("runDetails.title")}
            </button>
            {user && (
              <button
                type="button"
                onClick={() => setConfirmSignOut(true)}
                className="flex h-12 items-center gap-3 rounded-md px-3 text-[14px] text-error hover:bg-error-container/50"
              >
                <Icon name="logout" size={20} />
                {t("settings.signOut")}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-on-surface">{t("runDetails.title")}</h2>
              <button
                type="button"
                onClick={() => setView("menu")}
                aria-label={t("dialog.close")}
                className="flex h-9 w-9 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container"
              >
                <Icon name="arrow_back" size={20} />
              </button>
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
