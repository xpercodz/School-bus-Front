import { useState, type FormEvent } from "react";
import { useToast } from "@/components/Toast";
import {
  createDriver,
  regenerateDriverCode,
  useBuses,
  useDriverCodes,
  useStaffUsers,
  type StaffUser,
} from "@/lib/school-admin";
import { DriversSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { Dialog } from "@/components/Dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

interface NewDriver {
  name: string;
  code: string;
}

/**
 * Director-only Drivers page (the dashboard layout enforces the role): create
 * driver accounts (server-side, returns an auto-generated access code) and
 * manage codes — reveal, copy, regenerate, or issue a first code to a staff
 * account that has none. The bus column shows which bus each driver is assigned
 * to (edited on the Assignments page).
 */
export default function DriversPage() {
  const { t, locale, dir } = useLocale();
  const ltr = dir === "ltr";
  const { showToast } = useToast();

  const staff = useStaffUsers();
  const codes = useDriverCodes();
  const { buses, loading: busesLoading } = useBuses();

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newDriver, setNewDriver] = useState<NewDriver | null>(null);
  const [newDriverOpen, setNewDriverOpen] = useState(false);
  const [regenerateTarget, setRegenerateTarget] = useState<StaffUser | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const sectionTitle = (icon: string, label: string) => (
    <h2
      className={`flex items-center gap-2 border-b border-dash-outline-variant pb-2 text-dash-label-md uppercase text-dash-on-surface ${
        ltr ? "tracking-widest" : ""
      }`}
    >
      <Icon name={icon} size={18} variant="outlined" />
      {label}
    </h2>
  );

  const toggleReveal = (uid: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      showToast(t("drivers.copied"));
    } catch {
      showToast(t("drivers.copyError"));
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (creating || !trimmed) return;
    setCreating(true);
    try {
      const driver = await createDriver(trimmed);
      setNewDriver({ name: trimmed, code: driver.code });
      setNewDriverOpen(true);
      setName("");
      showToast(t("drivers.createdToast"));
    } catch {
      showToast(t("drivers.createError"));
    } finally {
      setCreating(false);
    }
  }

  async function handleRegenerate(staff: StaffUser) {
    setRegenerating(true);
    try {
      await regenerateDriverCode(staff.uid);
      showToast(t("drivers.regeneratedToast"));
    } catch {
      showToast(t("toast.error"));
    } finally {
      setRegenerating(false);
      setRegenerateTarget(null);
    }
  }

  return (
    <>
      <div className="border-b border-dash-outline-variant bg-dash-surface-container-low px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-dash-headline-lg text-dash-on-surface">{t("drivers.title")}</h1>
            <p className="text-dash-body-sm text-dash-on-surface-variant">{t("drivers.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 sm:p-6">
        {busesLoading ? (
          <div role="status" aria-label={t("dashboard.loading")}>
            <DriversSkeleton />
          </div>
        ) : (
          <>
            {/* Add driver */}
            <section className="flex flex-col gap-4">
              {sectionTitle("person_add", t("drivers.addTitle"))}
              <form
                onSubmit={handleCreate}
                className="flex flex-wrap items-end gap-3 rounded border border-dash-outline-variant bg-dash-surface p-4"
              >
                <div className="min-w-56 flex-1">
                  <label htmlFor="driver-name" className="text-dash-label-md text-dash-on-surface">
                    {t("drivers.nameLabel")}
                  </label>
                  <input
                    id="driver-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("drivers.namePlaceholder")}
                    className="mt-1 h-10 w-full rounded border border-dash-outline-variant bg-dash-surface px-3 text-dash-body-sm text-dash-on-surface transition-all placeholder:text-dash-outline focus:border-dash-primary focus:outline-none focus:ring-1 focus:ring-dash-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="flex h-10 items-center gap-2 rounded-full bg-dash-primary px-5 text-dash-label-md text-dash-on-primary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary disabled:opacity-50"
                >
                  {creating && (
                    <Icon name="progress_activity" size={16} variant="outlined" className="animate-spin" />
                  )}
                  {t("drivers.create")}
                </button>
              </form>
            </section>

            {/* Access codes table */}
            <section className="flex flex-col gap-4">
              {sectionTitle("badge", t("drivers.accessCodes"))}
              {staff.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded border border-dash-outline-variant bg-dash-surface py-10 text-center">
                  <Icon name="badge" size={32} variant="outlined" className="text-dash-on-surface-variant" />
                  <p className="text-dash-body-sm text-dash-on-surface-variant">{t("drivers.empty")}</p>
                  <p className="text-dash-body-sm text-dash-on-surface-variant">{t("drivers.emptyHint")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded border border-dash-outline-variant bg-dash-surface">
                  <table className="w-full min-w-[560px] border-collapse text-start">
                    <thead className="border-b border-dash-outline-variant bg-dash-surface-container text-dash-label-md uppercase text-dash-on-surface-variant">
                      <tr>
                        <th scope="col" className="h-10 px-4 py-2 font-medium">{t("drivers.th.name")}</th>
                        <th scope="col" className="h-10 px-4 py-2 font-medium">{t("drivers.th.bus")}</th>
                        <th scope="col" className="h-10 px-4 py-2 font-medium">{t("drivers.th.code")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dash-outline-variant text-dash-body-sm text-dash-on-surface">
                      {staff.map((driver) => {
                        const code = codes[driver.uid];
                        const bus = buses.find((b) => b.driverUid === driver.uid);
                        const shown = revealed.has(driver.uid);
                        return (
                          <tr key={driver.uid} className="hover:bg-dash-surface-container-low">
                            <td className="px-4 py-3 font-medium">{driver.displayName}</td>
                            <td className="px-4 py-3">
                              {bus ? translateDataLabel(bus.name, locale, t) : t("drivers.noBus")}
                            </td>
                            <td className="px-4 py-3">
                              {code ? (
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-dash-body-sm tracking-widest">
                                    {shown ? toLocaleDigits(code, locale) : "••••••"}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleReveal(driver.uid)}
                                      aria-label={
                                        shown
                                          ? t("drivers.hideAria", { name: driver.displayName })
                                          : t("drivers.revealAria", { name: driver.displayName })
                                      }
                                      className="flex h-8 w-8 items-center justify-center rounded-full text-dash-on-surface-variant transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
                                    >
                                      <Icon name={shown ? "visibility_off" : "visibility"} size={18} variant="outlined" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => copyCode(code)}
                                      aria-label={t("drivers.copyAria", { name: driver.displayName })}
                                      className="flex h-8 w-8 items-center justify-center rounded-full text-dash-on-surface-variant transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
                                    >
                                      <Icon name="content_copy" size={18} variant="outlined" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRegenerateTarget(driver)}
                                      aria-label={t("drivers.regenerateAria", { name: driver.displayName })}
                                      className="flex h-8 w-8 items-center justify-center rounded-full text-dash-on-surface-variant transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
                                    >
                                      <Icon name="refresh" size={18} variant="outlined" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRegenerate(driver)}
                                  className="flex h-9 items-center gap-1.5 rounded-full border border-dash-outline-variant bg-dash-surface px-3 text-dash-label-md text-dash-primary transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
                                >
                                  <Icon name="add_link" size={16} variant="outlined" />
                                  {t("drivers.generateCode")}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Newly created driver — code shown once */}
      <Dialog
        open={newDriverOpen}
        onClose={() => setNewDriverOpen(false)}
        title={t("drivers.newCodeTitle")}
        dismissable={false}
      >
        <div className="flex flex-col gap-6 p-6">
          <h2 className="text-headline-md text-on-surface">{t("drivers.newCodeTitle")}</h2>
          <p className="text-body-md text-on-surface-variant">
            {newDriver ? t("drivers.newCodeBody", { name: newDriver.name }) : ""}
          </p>
          {newDriver && (
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-headline-md tracking-[0.35em] text-primary">
                {toLocaleDigits(newDriver.code, locale)}
              </span>
              <button
                type="button"
                onClick={() => copyCode(newDriver.code)}
                aria-label={t("drivers.copyAria", { name: newDriver.name })}
                className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon name="content_copy" />
              </button>
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setNewDriverOpen(false)}
              className="flex h-12 items-center justify-center rounded-full px-6 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t("dialog.close")}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Regenerate confirmation */}
      <ConfirmDialog
        open={regenerateTarget !== null}
        title={t("drivers.regenerateConfirmTitle")}
        body={
          regenerateTarget
            ? t("drivers.regenerateConfirmBody", { name: regenerateTarget.displayName })
            : ""
        }
        confirmLabel={t("dialog.confirm")}
        cancelLabel={t("dialog.cancel")}
        busy={regenerating}
        onConfirm={() => regenerateTarget && handleRegenerate(regenerateTarget)}
        onClose={() => setRegenerateTarget(null)}
      />
    </>
  );
}
