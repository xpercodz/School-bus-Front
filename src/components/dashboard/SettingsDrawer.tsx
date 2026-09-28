import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/context";
import { useSignOut } from "@/lib/sign-out";
import { useUserProfile } from "@/lib/user-profile";
import { popDialog, pushDialog, topDialog } from "@/components/Dialog";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Closed accordion state: zero width. scaleX is hinged at the screen edge
 *  (transform-origin below), so the panel unfolds outward like an accordion
 *  instead of translating in from the side. */
const START_SCALE = "scaleX(0)";
/** Hinge (transform-origin): the screen edge the panel stays attached to —
 *  right in LTR (drawer on the right), left in RTL (drawer on the left). */
const HINGE_ORIGIN = "right center";
const HINGE_ORIGIN_RTL = "left center";

const ENTRY_MS = 320;

/** Gentle long deceleration — the drawer glides in and settles softly instead
 *  of easing out abruptly (ease-out-quint style curve). */
const ENTRY_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

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
    // painted the collapsed (zero-width) state first — that's what makes the
    // transition an accordion unfold instead of a flash.
    let raf = 0;
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setEntered(true));
    });
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
        className={`fixed inset-0 bg-black/40 cursor-pointer transition-opacity duration-200 ease-out ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel — unfolds like an accordion via a transform TRANSITION on
          scaleX, hinged at the screen edge (see header comment). */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
        tabIndex={-1}
        style={{
          transform: entered ? "scaleX(1)" : START_SCALE,
          transformOrigin: hingeOrigin,
          transition: `transform ${ENTRY_MS}ms ${ENTRY_EASING}`,
        }}
        className="relative flex h-full w-80 max-w-[90vw] flex-col overflow-hidden rounded-s-2xl bg-surface-container-low shadow-card outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
          <h2 className="text-headline-md text-on-surface">{t("settings.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("dialog.close")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <Icon name="close" variant="outlined" />
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-6 p-4">
            <section className="flex flex-col gap-3">
              <h3 className="text-dash-label-md uppercase text-dash-on-surface-variant">
                {t("settings.account")}
              </h3>
              <div className="flex items-center justify-between gap-4">
                <span className="text-dash-body-sm text-dash-on-surface-variant">
                  {t("settings.email")}
                </span>
                <span className="truncate text-dash-body-sm font-medium text-dash-on-surface">
                  {user?.email ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-dash-body-sm text-dash-on-surface-variant">
                  {t("settings.role")}
                </span>
                <span className="text-dash-body-sm font-medium text-dash-on-surface">
                  {roleLabel}
                </span>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-dash-label-md uppercase text-dash-on-surface-variant">
                {t("settings.language")}
              </h3>
              <LanguageToggle variant="dash" />
            </section>

            <LogoutButton label={t("settings.signOut")} onClick={() => setConfirmSignOut(true)} />
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

/**
 * Expanding logout button: a red circle with the door icon that grows into a
 * pill on hover while the label slides out next to the icon (not pinned to the
 * far edge). Ported from a styled-components reference to Tailwind (no new
 * dependencies). The label sits in normal flow right after the icon, so the
 * layout mirrors automatically in RTL (icon on the inline-start, label
 * extending inline-end). The expanded width is measured from the actual label
 * text so long (Arabic) and short (English) labels both fit without clipping
 * or a big empty tail.
 */
function LogoutButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [openWidth, setOpenWidth] = useState(170);

  // Measure the real label width and size the hover expansion to the text.
  // The measuring copy is appended to <body> — NOT inside the drawer — because
  // the drawer's entry animation scales the whole panel (accordion unfold):
  // measuring inside would return the mid-animation (scaled) width and cache a
  // half-sized expansion, which is exactly what made the pill open "half way"
  // after the first close/reopen.
  useEffect(() => {
    const measure = () => {
      const host = document.createElement("span");
      host.textContent = label;
      host.style.cssText =
        "position:fixed;visibility:hidden;left:0;top:0;white-space:nowrap;" +
        "font-size:15px;font-weight:600;";
      document.body.appendChild(host);
      const labelWidth = Math.ceil(host.getBoundingClientRect().width);
      host.remove();
      // 45px icon cell + inline-start gap + right padding for the rounded end.
      setOpenWidth(labelWidth + 45 + 26);
    };
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [label]);

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{ "--logout-open-w": `${openWidth}px` } as CSSProperties}
      className="group relative flex h-[45px] w-[45px] cursor-pointer items-center overflow-hidden rounded-full bg-[#ff4141] shadow-[2px_2px_10px_rgba(0,0,0,0.199)] outline-none transition-all duration-300 ease-in-out hover:w-[var(--logout-open-w)] hover:rounded-[40px] focus-visible:ring-2 focus-visible:ring-white/80 active:translate-x-0.5 active:translate-y-0.5"
    >
      {/* Icon cell — shifts slightly inline-end on hover (like the reference). */}
      <span className="flex h-full w-[45px] shrink-0 items-center justify-center transition-all duration-300 ease-in-out group-hover:ps-[16px]">
        <Icon name="logout" size={18} className="text-white" />
      </span>
      {/* Label — folded to zero width next to the icon; expands + fades in. */}
      <span className="flex h-full max-w-0 items-center overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-in-out group-hover:max-w-[300px] group-hover:opacity-100">
        <span className="pe-4 text-[15px] font-semibold text-white">{label}</span>
      </span>
    </button>
  );
}
