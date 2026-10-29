import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/arc/button/button";
import { prefersReducedMotion } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeModeControl } from "@/components/ThemeModeControl";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/context";
import { useSignOut } from "@/lib/sign-out";
import { useUserProfile } from "@/lib/user-profile";
import { popDialog, pushDialog, topDialog } from "@/components/Dialog";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Closed state: a short slide from the screen edge. */
const START_SCALE = "translateX(16px)";
/** Hinge (transform-origin): the screen edge the panel stays attached to —
 *  right in LTR (drawer on the right), left in RTL (drawer on the left). */
const HINGE_ORIGIN = "right center";
const HINGE_ORIGIN_RTL = "left center";

/**
 * End-drawer settings for the dashboard top bar: account, language, sign out.
 *
 * Self-contained overlay — deliberately does NOT use the shared Dialog:
 * the drawer opens with a single one-shot CSS transition driven by an explicit
 * mount → next-frame state flip, instead of a CSS keyframe animation. A
 * keyframe entry re-asserts itself while the element stays mounted, which
 * manifested as the panel trembling/jumping toward the center while open on
 * some engines. A transition runs exactly once per state change, so the open
 * state is stable until the drawer is closed.
 *
 * Backend logic (profile, locale, sign-out + confirm) is identical to the
 * previous implementation; only the overlay chrome/animation is rebuilt.
 * Closes instantly (app convention); Escape/backdrop/close-button all close it,
 * focus moves in and is trapped, and the body scroll is locked while open.
 * Participates in the shared dialog stack so the confirm dialog layered on top
 * owns Escape while it is open.
 */
export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const { t } = useLocale();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const signOut = useSignOut();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [busy, setBusy] = useState(false);
  // false → panel is collapsed at zero width (hinged to the screen edge);
  // true (next frame after mount) → transition to full width. Only ever
  // flips once per open.
  const [entered, setEntered] = useState(false);
  // Reduced motion: the drawer is simply present. The `.dlg-end-panel` class
  // removes the inline transition; this flag removes the 16px start state so
  // there is no one-frame jump either.
  const reducedMotion = prefersReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without re-running the open-effect on every render.
  const onCloseRef = useRef(onClose);
  // Direction at open time — the accordion hinge side is direction-aware.
  // State (not a ref): the value feeds render styles.
  const [hingeOrigin, setHingeOrigin] = useState(HINGE_ORIGIN);

  // Collapse to zero width whenever the drawer closes, so the next open
  // unfolds from the hinge again — and capture the direction at open time.
  // Adjusted during render (the documented respond-to-prop-change pattern),
  // not in an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setHingeOrigin(
        typeof document !== "undefined" && document.documentElement.dir === "rtl"
          ? HINGE_ORIGIN_RTL
          : HINGE_ORIGIN,
      );
    } else {
      setEntered(false);
    }
  }

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const dialogId = pushDialog();
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Unfold to full width on the frame after mount so the browser has
    // painted the collapsed state first — that's what makes the transition a
    // glide instead of a flash. Reduced motion skips straight to open.
    let raf = 0;
    if (prefersReducedMotion()) {
      setEntered(true);
    } else {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setEntered(true));
      });
    }
    panelRef.current?.focus();

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        if (topDialog() === dialogId) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }
      // Trap Tab focus within the panel.
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel || topDialog() !== dialogId) return;
        const focusables = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      popDialog(dialogId);
      document.body.style.overflow = previousOverflow;
      lastFocusedRef.current?.focus();
    };
  }, [open]);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      setConfirmSignOut(false);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = profile.role
    ? t(profile.role === "director" ? "role.director" : "role.staff")
    : "—";

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end overflow-hidden print:hidden">
      {/* Backdrop — dims in with the panel (opacity transition, single-shot). */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 bg-[var(--overlay)] cursor-pointer transition-opacity duration-[var(--t-hover)] ease-[var(--ease-out-soft)] motion-reduce:transition-none ${
          entered || reducedMotion ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel — glides the last 16px in from the screen edge with a
          one-shot transform transition (see header comment). */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
        tabIndex={-1}
        style={{
          transform:
            entered || reducedMotion
              ? "translateX(0)"
              : hingeOrigin === HINGE_ORIGIN_RTL
                ? "translateX(-16px)"
                : START_SCALE,
          transformOrigin: hingeOrigin,
          transition: "transform var(--t-enter) var(--ease-out-soft)",
        }}
        className="dlg-end-panel relative flex h-full w-[360px] max-w-[90vw] flex-col overflow-hidden border-s border-dash-outline-variant bg-dash-surface pb-[env(safe-area-inset-bottom)] shadow-float outline-none"
      >
        {/* Header — one palette (dashboard) end to end, so no `bg-surface`
            panel wraps `text-dash-*` children. */}
        <div className="flex items-center justify-between gap-3 border-b border-dash-outline-variant px-5 py-3">
          <h2 className="min-w-0 truncate text-[17px] font-semibold text-dash-on-surface">
            {t("settings.title")}
          </h2>
          <Button
            type="button"
            onClick={onClose}
            aria-label={t("dialog.close")}
            variant="ghost"
            size="md"
            icon
            className="flex-none"
          >
            <Icon name="close" size={22} variant="outlined" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-6 p-5">
            <section className="flex flex-col gap-3">
              <h3 className="text-[12px] font-medium text-dash-on-surface-variant">
                {t("settings.account")}
              </h3>
              <div className="flex min-h-11 items-center justify-between gap-4">
                <span className="flex-none text-[13px] text-dash-on-surface-variant">
                  {t("settings.email")}
                </span>
                <span className="min-w-0 truncate text-[13px] font-medium text-dash-on-surface">
                  {user?.email ?? "—"}
                </span>
              </div>
              <div className="flex min-h-11 items-center justify-between gap-4">
                <span className="text-[13px] text-dash-on-surface-variant">
                  {t("settings.role")}
                </span>
                <span className="text-[13px] font-medium text-dash-on-surface">
                  {roleLabel}
                </span>
              </div>
            </section>

            {/* ThemeModeControl/LanguageToggle keep their compact dashboard
                height on a wide screen; inside this drawer every row is a
                44px target, so the segmented track and the language button
                get a min-height here rather than forking the components. */}
            <section className="flex flex-col gap-3 [&>div]:min-h-11">
              <h3 className="text-[12px] font-medium text-dash-on-surface-variant">
                {t("settings.appearance")}
              </h3>
              <ThemeModeControl />
            </section>

            <section className="flex flex-col gap-3 [&_button]:min-h-11">
              <h3 className="text-[12px] font-medium text-dash-on-surface-variant">
                {t("settings.language")}
              </h3>
              <LanguageToggle variant="dash" />
            </section>

            <Button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              variant="danger"
              size="md"
              className="arc-field w-full"
            >
              <Icon name="logout" size={18} variant="outlined" />
              {t("settings.signOut")}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        title={t("confirm.signOut.title")}
        body={t("confirm.signOut.body")}
        confirmLabel={t("dialog.confirm")}
        cancelLabel={t("dialog.cancel")}
        busy={busy}
        onConfirm={handleSignOut}
        onClose={() => setConfirmSignOut(false)}
      />
    </div>,
    document.body,
  );
}
