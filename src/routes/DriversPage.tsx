import { useState, type FormEvent, type ReactNode } from "react";
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
import { Reveal } from "@/components/Reveal";
import { staggerStyle } from "@/lib/motion";
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
 * account that has none. The bus line shows which bus each driver is assigned
 * to (edited on the Assignments page).
 *
 * The access-codes table is the md+ composition; below md each driver becomes a
 * card with the code and a 44px action row, because a three-column table on a
 * phone would either scroll sideways or shrink the tap targets.
 */
export default function DriversPage() {
  const { t, locale } = useLocale();
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

  const sectionTitle = (icon: ReactNode, label: string) => (
    <h2 className="flex items-center gap-2 text-[15px] font-semibold text-dash-on-surface">
      {icon}
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
      <div className="px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-dash-headline-lg text-dash-on-surface">{t("drivers.title")}</h1>
            <p className="text-[13px] text-dash-on-surface-variant">{t("drivers.subtitle")}</p>
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
            <Reveal delay={0}>
              <section className="flex flex-col gap-4">
                {sectionTitle(
                  <Icon name="person_add" size={18} variant="outlined" className="flex-none" />,
                  t("drivers.addTitle"),
                )}
                <form
                  onSubmit={handleCreate}
                  className="flex flex-col gap-3 rounded-lg border border-dash-outline-variant bg-dash-surface p-4 sm:flex-row sm:flex-wrap sm:items-end"
                >
                  <div className="min-w-0 flex-1 sm:min-w-56">
                    <label htmlFor="driver-name" className="block text-dash-label-md text-dash-on-surface">
                      {t("drivers.nameLabel")}
                    </label>
                    <input
                      id="driver-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("drivers.namePlaceholder")}
                      className="mt-1 h-11 w-full rounded-lg border border-dash-control-outline bg-dash-surface px-3 text-[16px] text-dash-on-surface placeholder:text-dash-outline focus:border-dash-primary focus:outline-none focus:ring-1 focus:ring-dash-primary sm:h-10 sm:text-dash-body-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={creating || !name.trim()}
                    className="press flex h-11 w-full items-center justify-center gap-2 rounded-md bg-dash-on-surface px-4 text-[12.5px] font-medium text-dash-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary disabled:opacity-50 sm:h-10 sm:w-auto"
                  >
                    {creating && (
                      <Icon name="progress_activity" size={16} variant="outlined" className="animate-spin" />
                    )}
                    {t("drivers.create")}
                  </button>
                </form>
              </section>
            </Reveal>

            {/* Access codes: cards on a phone, the table at md+ */}
            <section className="flex flex-col gap-4">
                {sectionTitle(
                  <Icon name="badge" size={18} variant="outlined" className="flex-none" />,
                  t("drivers.accessCodes"),
                )}
                {staff.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dash-outline-variant bg-dash-surface px-4 py-10 text-center">
                    <Icon name="badge" size={32} variant="outlined" className="text-dash-on-surface-variant" />
                    <p className="text-[13px] text-dash-on-surface-variant">{t("drivers.empty")}</p>
                    <p className="text-[13px] text-dash-on-surface-variant">{t("drivers.emptyHint")}</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
                    <ul className="divide-y divide-dash-outline-variant md:hidden">
                      {staff.map((driver, index) => {
                        const code = codes[driver.uid];
                        const bus = buses.find((b) => b.driverUid === driver.uid);
                        const shown = revealed.has(driver.uid);
                        return (
                          <li
                            key={driver.uid}
                            className="stagger-in px-4 py-3.5"
                            style={staggerStyle(index, staff.length)}
                          >
                            <p className="break-words text-[13.5px] font-medium leading-5 text-dash-on-surface">
                              {driver.displayName}
                            </p>
                            <p className="mt-0.5 break-words text-[12px] leading-4 text-dash-on-surface-variant">
                              {bus ? translateDataLabel(bus.name, locale, t) : t("drivers.noBus")}
                            </p>
                            {code ? (
                              <>
                                <div className="mt-2 flex items-center justify-between gap-3">
                                  <span className="text-[11.5px] leading-4 text-dash-on-surface-variant">
                                    {t("drivers.th.code")}
                                  </span>
                                  <span className="text-[13px] font-medium leading-5 tabular-nums tracking-[0.18em] text-dash-on-surface">
                                    {shown ? toLocaleDigits(code, locale) : "••••••"}
                                  </span>
                                </div>
                                <div className="mt-2 flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleReveal(driver.uid)}
                                    aria-label={
                                      shown
                                        ? t("drivers.hideAria", { name: driver.displayName })
                                        : t("drivers.revealAria", { name: driver.displayName })
                                    }
                                    className="press flex h-11 w-11 items-center justify-center rounded-lg border border-dash-outline-variant bg-dash-surface text-dash-on-surface-variant hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
                                  >
                                    <Icon name={shown ? "visibility_off" : "visibility"} size={18} variant="outlined" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyCode(code)}
                                    aria-label={t("drivers.copyAria", { name: driver.displayName })}
                                    className="press flex h-11 w-11 items-center justify-center rounded-lg border border-dash-outline-variant bg-dash-surface text-dash-on-surface-variant hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
                                  >
                                    <Icon name="content_copy" size={18} variant="outlined" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRegenerateTarget(driver)}
                                    aria-label={t("drivers.regenerateAria", { name: driver.displayName })}
                                    className="press flex h-11 w-11 items-center justify-center rounded-lg border border-dash-outline-variant bg-dash-surface text-dash-on-surface-variant hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
                                  >
                                    <Icon name="refresh" size={18} variant="outlined" />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRegenerate(driver)}
                                className="press mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dash-control-outline bg-dash-surface px-3 text-[12.5px] font-medium text-dash-primary hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
                              >
                                <Icon name="add_link" size={16} variant="outlined" />
                                {t("drivers.generateCode")}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[560px] border-collapse text-start">
                        <thead className="border-b border-dash-outline-variant text-[11.5px] text-dash-on-surface-variant">
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
                                      <span className="text-[13px] tabular-nums tracking-[0.18em]">
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
                                          className="press flex h-8 w-8 items-center justify-center rounded-full text-dash-on-surface-variant hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
                                        >
                                          <Icon name={shown ? "visibility_off" : "visibility"} size={18} variant="outlined" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => copyCode(code)}
                                          aria-label={t("drivers.copyAria", { name: driver.displayName })}
                                          className="press flex h-8 w-8 items-center justify-center rounded-full text-dash-on-surface-variant hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
                                        >
                                          <Icon name="content_copy" size={18} variant="outlined" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setRegenerateTarget(driver)}
                                          aria-label={t("drivers.regenerateAria", { name: driver.displayName })}
                                          className="press flex h-8 w-8 items-center justify-center rounded-full text-dash-on-surface-variant hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
                                        >
                                          <Icon name="refresh" size={18} variant="outlined" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleRegenerate(driver)}
                                      className="press flex h-9 items-center gap-1.5 rounded-full border border-dash-control-outline bg-dash-surface px-3 text-dash-label-md text-dash-primary hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
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
              <span className="tabular-nums text-headline-md tracking-[0.35em] text-primary">
                {toLocaleDigits(newDriver.code, locale)}
              </span>
              <button
                type="button"
                onClick={() => copyCode(newDriver.code)}
                aria-label={t("drivers.copyAria", { name: newDriver.name })}
                className="press flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon name="content_copy" />
              </button>
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setNewDriverOpen(false)}
              className="press flex h-11 items-center justify-center rounded-md px-5 text-[13.5px] text-on-surface-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
