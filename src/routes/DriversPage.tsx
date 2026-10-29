import { useEffect, useMemo, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import {
  createDriver,
  regenerateDriverCode,
  useBuses,
  useDriverCodes,
  useStaffUsers,
  type StaffUser,
} from "@/lib/school-admin";
import { DriversSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { Button } from "@/components/arc/button/button";
import { ExpandingSearch } from "@/components/arc/expanding-search/expanding-search";
import { IconMorph } from "@/components/arc/icon-morph/icon-morph";
import { PaginationBar } from "@/components/dashboard/PaginationBar";
import { usePageReveal } from "@/lib/use-page-reveal";
import { usePageSlice } from "@/lib/use-page-slice";
import { Dialog } from "@/components/Dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { staggerStyle } from "@/lib/motion";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

/**
 * Copy an access code and say so in the icon itself: the sheets tuck away and a
 * check draws in (@uiarc/icon-morph), then it settles back to the copy glyph.
 * The toast still announces it for anyone not watching the button.
 */
function CopyCodeButton({
  onCopy,
  label,
  copiedLabel,
  variant,
  size,
  className,
}: {
  onCopy: () => Promise<boolean>;
  label: string;
  copiedLabel: string;
  variant: NonNullable<ComponentProps<typeof Button>["variant"]>;
  size: NonNullable<ComponentProps<typeof Button>["size"]>;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      onClick={async () => {
        if (await onCopy()) setCopied(true);
      }}
      aria-label={copied ? copiedLabel : label}
      variant={variant}
      size={size}
      icon
      className={className}
    >
      <IconMorph name="copy" state={copied} size={18} />
    </Button>
  );
}

/**
 * A driver's access code, or its mask. A code issued in this session arrives
 * with one scan line crossing it (`.code-issued` / `.code-scan` in
 * globals.css). Callers key this node by the code, so a rotation replays the
 * animation instead of mutating it in place.
 */
function AccessCode({
  code,
  shown,
  issued,
  className,
}: {
  code: string;
  shown: boolean;
  issued: boolean;
  className?: string;
}) {
  const { locale } = useLocale();
  return (
    <span
      className={`relative inline-block overflow-hidden rounded px-1 ${issued ? "code-issued" : ""} ${className ?? ""}`}
    >
      <span className="relative z-10">
        {shown ? toLocaleDigits(code, locale) : "••••••"}
      </span>
      {issued && <span className="code-scan" aria-hidden="true" />}
    </span>
  );
}

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

  const { staff, loading: staffLoading } = useStaffUsers();
  const [driverQuery, setDriverQuery] = useState("");
  // The search narrows the loaded staff list before pagination, so the page
  // count and the pager always describe what is on screen.
  const filteredStaff = useMemo(() => {
    const q = driverQuery.trim().toLocaleLowerCase();
    if (!q) return staff;
    return staff.filter((member) => member.displayName.toLocaleLowerCase().includes(q));
  }, [staff, driverQuery]);
  const staffPage = usePageSlice(filteredStaff, 10, driverQuery);
  const codes = useDriverCodes();
  const { buses, loading: busesLoading } = useBuses();
  // Both snapshots gate the skeleton: gating only on buses flashed "No drivers
  // yet" for the gap before the staff list arrived. The reveal then runs once,
  // with every block already mounted, exactly like the live monitor.
  const contentLoading = busesLoading || staffLoading;
  usePageReveal(!contentLoading);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newDriver, setNewDriver] = useState<NewDriver | null>(null);
  const [newDriverOpen, setNewDriverOpen] = useState(false);
  const [regenerateTarget, setRegenerateTarget] = useState<StaffUser | null>(null);
  // Which driver's code request is in flight, so only that row shows a spinner.
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  // Codes are stored hashed, so the API returns plaintext exactly once (at
  // create/rotate). Hold the ones issued in this session in memory: without
  // this, a successful rotation had nowhere to show its result and the row
  // fell back to "Generate code" forever.
  const [issuedCodes, setIssuedCodes] = useState<Record<string, string>>({});

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

  async function copyCode(code: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(code);
      showToast(t("drivers.copied"));
      return true;
    } catch {
      showToast(t("drivers.copyError"));
      return false;
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
      // The account lands in the realtime staff list shortly; show its code in
      // the table too, not only in the one-time dialog.
      setIssuedCodes((prev) => ({ ...prev, [driver.uid]: driver.code }));
      setRevealed((prev) => new Set(prev).add(driver.uid));
      setName("");
      showToast(t("drivers.createdToast"));
    } catch {
      showToast(t("drivers.createError"));
    } finally {
      setCreating(false);
    }
  }

  /**
   * Issue (or rotate) a code. The API answers with the plaintext exactly once —
   * it is hashed at rest — so the result is kept in component state and shown
   * in the row; the row must never fall back to "Generate code" afterwards.
   */
  async function issueCode(driver: StaffUser) {
    if (busyUid) return;
    setBusyUid(driver.uid);
    try {
      const code = await regenerateDriverCode(driver.uid);
      setIssuedCodes((prev) => ({ ...prev, [driver.uid]: code }));
      setRevealed((prev) => new Set(prev).add(driver.uid));
      showToast(t("drivers.codeIssuedToast", { name: driver.displayName }));
    } catch (error) {
      const unreachable =
        error instanceof ApiError &&
        (error.code === "network_error" || error.code === "not_configured");
      showToast(t(unreachable ? "drivers.generateOffline" : "drivers.generateError"));
    } finally {
      setBusyUid(null);
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
        {contentLoading ? (
          <div role="status" aria-label={t("dashboard.loading")}>
            <DriversSkeleton />
          </div>
        ) : (
          <>
            {/* Add driver */}
            <section data-page-reveal className="flex flex-col gap-4">
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
                <Button
                  type="submit"
                  disabled={creating || !name.trim()}
                  loading={creating}
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto"
                >
                  {t("drivers.create")}
                </Button>
              </form>
            </section>

            {/* Access codes: cards on a phone, the table at md+ */}
            <section className="flex flex-col gap-4">
              <div data-page-reveal className="flex flex-col gap-4">
                {sectionTitle(
                  <Icon name="badge" size={18} variant="outlined" className="flex-none" />,
                  t("drivers.accessCodes"),
                )}
                {staff.length > 0 && (
                  <div className="w-full sm:w-64">
                    <ExpandingSearch
                      anchor="start"
                      label={t("drivers.searchAria")}
                      placeholder={t("drivers.searchPlaceholder")}
                      clearLabel={t("mobile.clearSearchAria")}
                      value={driverQuery}
                      onValueChange={setDriverQuery}
                    />
                  </div>
                )}
              </div>
                {staff.length === 0 ? (
                  <div data-page-reveal className="flex flex-col items-center gap-2 rounded-lg border border-dash-outline-variant bg-dash-surface px-4 py-10 text-center">
                    <Icon name="badge" size={32} variant="outlined" className="text-dash-on-surface-variant" />
                    <p className="text-[13px] text-dash-on-surface-variant">{t("drivers.empty")}</p>
                    <p className="text-[13px] text-dash-on-surface-variant">{t("drivers.emptyHint")}</p>
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div data-page-reveal className="flex flex-col items-center gap-2 rounded-lg border border-dash-outline-variant bg-dash-surface px-4 py-10 text-center">
                    <Icon name="search_off" size={32} variant="outlined" className="text-dash-on-surface-variant" />
                    <p className="text-[13px] text-dash-on-surface-variant">{t("drivers.searchEmptyTitle")}</p>
                    <p className="text-[13px] text-dash-on-surface-variant">{t("drivers.searchEmptyBody")}</p>
                  </div>
                ) : (
                  <div data-page-reveal className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
                    <ul className="divide-y divide-dash-outline-variant md:hidden">
                      {staffPage.paged.map((driver, index) => {
                        const issued = Boolean(issuedCodes[driver.uid]);
                        const code = issuedCodes[driver.uid] ?? codes[driver.uid] ?? "";
                        const bus = buses.find((b) => b.driverUid === driver.uid);
                        const shown = revealed.has(driver.uid);
                        return (
                          <li
                            key={driver.uid}
                            className="stagger-in px-4 py-3.5"
                            style={staggerStyle(index, staffPage.paged.length)}
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
                                  <AccessCode
                                    key={issued ? code : "masked"}
                                    code={code}
                                    shown={shown}
                                    issued={issued}
                                    className="text-[13px] font-medium leading-5 tabular-nums tracking-[0.18em] text-dash-on-surface"
                                  />
                                </div>
                                {issued && (
                                  <p className="mt-1 text-end text-[11.5px] leading-4 text-dash-on-surface-variant">
                                    {t("drivers.codeOnceHint")}
                                  </p>
                                )}
                                <div className="mt-2 flex items-center justify-end gap-1.5">
                                  <Button
                                    type="button"
                                    onClick={() => toggleReveal(driver.uid)}
                                    aria-label={
                                      shown
                                        ? t("drivers.hideAria", { name: driver.displayName })
                                        : t("drivers.revealAria", { name: driver.displayName })
                                    }
                                    variant="secondary"
                                    size="md"
                                    icon
                                    className="arc-field"
                                  >
                                    <Icon name={shown ? "visibility_off" : "visibility"} size={18} variant="outlined" />
                                  </Button>
                                  <CopyCodeButton
                                    onCopy={() => copyCode(code)}
                                    label={t("drivers.copyAria", { name: driver.displayName })}
                                    copiedLabel={t("drivers.copied")}
                                    variant="secondary"
                                    size="md"
                                    className="arc-field"
                                  />
                                  <Button
                                    type="button"
                                    onClick={() => setRegenerateTarget(driver)}
                                    aria-label={t("drivers.regenerateAria", { name: driver.displayName })}
                                    variant="secondary"
                                    size="md"
                                    icon
                                    className="arc-field"
                                  >
                                    <Icon name="refresh" size={18} variant="outlined" />
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <Button
                                type="button"
                                onClick={() => issueCode(driver)}
                                disabled={busyUid !== null}
                                loading={busyUid === driver.uid}
                                variant="secondary"
                                size="md"
                                className="arc-field mt-2 w-full"
                              >
                                <Icon name="add_link" size={16} variant="outlined" />
                                {t("drivers.generateCode")}
                              </Button>
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
                          {staffPage.paged.map((driver) => {
                            const issued = Boolean(issuedCodes[driver.uid]);
                            const code = issuedCodes[driver.uid] ?? codes[driver.uid] ?? "";
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
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-3">
                                        <AccessCode
                                          key={issued ? code : "masked"}
                                          code={code}
                                          shown={shown}
                                          issued={issued}
                                          className="text-[13px] tabular-nums tracking-[0.18em]"
                                        />
                                        <div className="flex items-center gap-1">
                                          <Button
                                            type="button"
                                            onClick={() => toggleReveal(driver.uid)}
                                            aria-label={
                                              shown
                                                ? t("drivers.hideAria", { name: driver.displayName })
                                                : t("drivers.revealAria", { name: driver.displayName })
                                            }
                                            variant="ghost"
                                            size="sm"
                                            icon
                                          >
                                            <Icon name={shown ? "visibility_off" : "visibility"} size={18} variant="outlined" />
                                          </Button>
                                          <CopyCodeButton
                                            onCopy={() => copyCode(code)}
                                            label={t("drivers.copyAria", { name: driver.displayName })}
                                            copiedLabel={t("drivers.copied")}
                                            variant="ghost"
                                            size="sm"
                                          />
                                          <Button
                                            type="button"
                                            onClick={() => setRegenerateTarget(driver)}
                                            aria-label={t("drivers.regenerateAria", { name: driver.displayName })}
                                            variant="ghost"
                                            size="sm"
                                            icon
                                          >
                                            <Icon name="refresh" size={18} variant="outlined" />
                                          </Button>
                                        </div>
                                      </div>
                                      {issued && (
                                        <p className="text-[11.5px] leading-4 text-dash-on-surface-variant">
                                          {t("drivers.codeOnceHint")}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <Button
                                      type="button"
                                      onClick={() => issueCode(driver)}
                                      disabled={busyUid !== null}
                                      loading={busyUid === driver.uid}
                                      variant="secondary"
                                      size="sm"
                                      className="arc-field"
                                    >
                                      <Icon name="add_link" size={16} variant="outlined" />
                                      {t("drivers.generateCode")}
                                    </Button>
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
                {staffPage.totalPages > 1 && (
                  <PaginationBar pagination={staffPage} />
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
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center justify-center gap-3">
                <AccessCode
                  key={newDriver.code}
                  code={newDriver.code}
                  shown
                  issued
                  className="text-headline-md tracking-[0.35em] text-primary"
                />
                <CopyCodeButton
                  onCopy={() => copyCode(newDriver.code)}
                  label={t("drivers.copyAria", { name: newDriver.name })}
                  copiedLabel={t("drivers.copied")}
                  variant="ghost"
                  size="md"
                />
              </div>
              <p className="text-center text-[12px] leading-4 text-on-surface-variant">
                {t("drivers.codeOnceHint")}
              </p>
            </div>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setNewDriverOpen(false)}
              variant="ghost"
              size="md"
            >
              {t("dialog.close")}
            </Button>
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
        busy={busyUid !== null && busyUid === regenerateTarget?.uid}
        onConfirm={() => regenerateTarget && issueCode(regenerateTarget)}
        onClose={() => setRegenerateTarget(null)}
      />
    </>
  );
}
