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
  /** False when live mode has no run doc yet (shows "No run started"). */
  runExists: boolean;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-label-lg text-on-surface-variant">{label}</dt>
      <dd className="text-label-lg font-medium text-on-surface">{value}</dd>
    </div>
  );
}

/** Mobile top bar — brand, language toggle, and an overflow menu (run details / sign out). */
export function TopAppBar({ runMeta, runStatus, runExists }: TopAppBarProps) {
  const { t, dir, locale } = useLocale();
  const { user } = useAuth();
  const signOut = useSignOut();

  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<"menu" | "details">("menu");
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const ltr = dir === "ltr";
  const backIcon = ltr ? "arrow_back" : "arrow_forward";

  function openMenu() {
    setView("menu");
    setMenuOpen(true);
  }

  async function handleSignOut() {
    setConfirmSignOut(false);
    setMenuOpen(false);
    await signOut();
  }

  const busNumber = runMeta.busId
    ? toLocaleDigits(runMeta.busId.replace(/^bus/, ""), locale)
    : null;
  const busLabel = runMeta.busId
    ? translateDataLabel(`Bus ${runMeta.busId.replace(/^bus/, "")}`, locale, t)
    : "—";

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between bg-surface px-4">
      <div className="flex items-center gap-2">
        <Icon name="directions_bus" />
        <h1 className="text-headline-md">
          {busNumber
            ? t("mobile.appBarTitle", { bus: busNumber })
            : t("mobile.appBarTitleNoBus")}
        </h1>
      </div>
      <div className="flex items-center gap-1">
        <LanguageToggle />
        <button
          type="button"
          aria-label={t("mobile.moreOptionsAria")}
          onClick={openMenu}
          className="flex h-12 w-12 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container-high"
        >
          <Icon name="more_vert" />
        </button>
      </div>

      <Dialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t("mobile.moreOptionsAria")}
        placement="bottom"
      >
        {view === "menu" ? (
          <div className="flex flex-col p-2">
            <button
              type="button"
              onClick={() => setView("details")}
              className="flex h-14 items-center gap-3 rounded-full px-4 text-label-lg text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <Icon name="info" />
              {t("runDetails.title")}
            </button>
            {user && (
              <button
                type="button"
                onClick={() => setConfirmSignOut(true)}
                className="flex h-14 items-center gap-3 rounded-full px-4 text-label-lg text-error transition-colors hover:bg-error-container/40"
              >
                <Icon name="logout" />
                {t("settings.signOut")}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-headline-md text-on-surface">
                {t("runDetails.title")}
              </h2>
              <button
                type="button"
                onClick={() => setView("menu")}
                aria-label={t("dialog.close")}
                className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
              >
                <Icon name={backIcon} />
              </button>
            </div>
            <dl className="space-y-3">
              <DetailRow label={t("runDetails.bus")} value={busLabel} />
              <DetailRow
                label={t("runDetails.type")}
                value={t(
                  runMeta.runType === "afternoon"
                    ? "runType.afternoonDropoff"
                    : "runType.morningPickup",
                )}
              />
              <DetailRow
                label={t("runDetails.date")}
                value={formatDate(runMeta.date, locale)}
              />
              <DetailRow
                label={t("runDetails.status")}
                value={
                  runExists
                    ? t(
                        runStatus === "COMPLETED"
                          ? "dashboard.completed"
                          : "dashboard.inProgress",
                      )
                    : t("runDetails.noRun")
                }
              />
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
