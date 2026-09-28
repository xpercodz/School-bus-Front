import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Placement = "center" | "bottom" | "end";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Localized title; also the panel's aria-label. */
  title?: string;
  /** center = modal, bottom = sheet, end = inline-end drawer. */
  placement?: Placement;
  /** false makes the overlay non-dismissable (Escape/backdrop ignored). */
  dismissable?: boolean;
  /**
   * Replaces the sizing/background classes for the chosen placement entirely —
   * used to give a placement a custom panel (e.g. the dashboard nav drawer).
   * Replaces rather than appends so a custom background can't lose a
   * specificity tie with the placement's default.
   */
  panelClassName?: string;
  children: ReactNode;
}

const WRAPPER_CLASS: Record<Placement, string> = {
  // center/bottom can exceed the viewport, so the whole overlay scrolls. The
  // end drawer is full-height with its own inner scroll wrapper, and a
  // non-scrolling wrapper lets the slide run on the compositor (a transform
  // animation inside a scroll container rasterizes per frame and jitters).
  center: "items-center justify-center overflow-y-auto overflow-x-hidden",
  bottom: "flex-col justify-end overflow-y-auto overflow-x-hidden",
  end: "justify-end overflow-hidden",
};

const PANEL_CLASS: Record<Placement, string> = {
  center: "w-full max-w-md rounded-2xl bg-surface-container-low",
  bottom: "w-full max-w-lg rounded-t-2xl bg-surface-container-low",
  end: "h-full w-80 max-w-[90vw] rounded-s-2xl bg-surface-container-low",
};

// Entry animation per placement: center/bottom fade in via keyframes (a
// one-shot mount animation is fine for a fade). End drawers do NOT use these
// classes — they unfold like an accordion through an inline transform
// transition (scaleX hinged at the screen edge), which proved stable where
// keyframe/translate entries trembled or jumped on some engines.
const ANIMATION_CLASS: Record<Placement, string> = {
  center: "dlg-fade-in",
  bottom: "dlg-fade-in",
  end: "",
};

// Track open dialogs in mount order so Escape only closes the topmost one. When
// a non-dismissable confirm sits over a dismissable menu/drawer, Escape must
// not close the menu underneath it. Exported so overlay components that don't
// use this Dialog (e.g. the settings drawer) can share the same ordering.
const dialogStack: number[] = [];
let nextDialogId = 0;

/** Register an open overlay; returns its stack id. */
export function pushDialog(): number {
  const id = ++nextDialogId;
  dialogStack.push(id);
  return id;
}

/** Unregister an overlay (cleanup on close/unmount). */
export function popDialog(id: number): void {
  const index = dialogStack.indexOf(id);
  if (index >= 0) dialogStack.splice(index, 1);
}

/** Id of the topmost open overlay, or undefined when none is open. */
export function topDialog(): number | undefined {
  return dialogStack[dialogStack.length - 1];
}

/**
 * Accessible overlay primitive used by every modal/drawer/sheet in the app.
 * Renders a fixed backdrop + panel that open with a quick fade and close
 * instantly; the body is scroll-locked while open, focus moves into the
 * panel and is trapped (Tab cycles within it), and Escape / backdrop click
 * close the *topmost* open dialog (unless non-dismissable). Uses the mobile
 * (default) palette so it renders identically on both sections; RTL-safe via
 * logical utilities.
 */
export function Dialog({
  open,
  onClose,
  title,
  placement = "center",
  dismissable = true,
  panelClassName,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without re-running the open-effect on every render.
  const onCloseRef = useRef(onClose);
  const isEndDrawer = placement === "end";
  // End drawers open like an accordion — scaleX hinged at the screen edge,
  // driven by an inline single-shot transition (the same mechanics as the
  // settings drawer). Keyframe entries and translate-slides proved unstable
  // on some engines (drawers trembling/jumping), so nothing else is used here.
  // The hinge side depends on direction and is captured when the drawer opens.
  const [entered, setEntered] = useState(false);
  const [hingeOrigin, setHingeOrigin] = useState("right center");
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setEntered(false);
    } else if (isEndDrawer) {
      setHingeOrigin(
        typeof document !== "undefined" && document.documentElement.dir === "rtl"
          ? "left center"
          : "right center",
      );
    }
  }
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Unfold the end drawer one frame after mount so the browser has painted
  // the collapsed (zero-width) state first — a transition needs a previous
  // computed style, and without it the panel would just appear.
  useEffect(() => {
    if (!open || !isEndDrawer) return;
    let raf = 0;
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [open, isEndDrawer]);

  useEffect(() => {
    if (!open) return;
    const dialogId = pushDialog();
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        if (dismissable && topDialog() === dialogId) {
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
      popDialog(dialogId);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      lastFocusedRef.current?.focus();
    };
  }, [open, dismissable]);

  if (!open) return null;

  // Rendered through a portal to <body> so the overlay escapes any parent
  // stacking context (e.g. the sticky z-10 top bar or the z-20 sidebar) and
  // truly sits at z-80 above everything, dimming the whole screen behind the
  // panel. Safe for SSR: `open` is always false on the server.
  // Entry animation: center/bottom fade via keyframes; end drawers unfold
  // like an accordion through an inline transform transition (see above).
  return createPortal(
    <div className={`fixed inset-0 z-[80] flex ${WRAPPER_CLASS[placement]}`}>
      <div
        aria-hidden="true"
        className={`fixed inset-0 bg-black/40 dlg-fade-in print:hidden ${dismissable ? "cursor-pointer" : ""}`}
        onClick={dismissable ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? undefined}
        tabIndex={-1}
        style={
          isEndDrawer
            ? {
                transform: entered ? "scaleX(1)" : "scaleX(0)",
                transformOrigin: hingeOrigin,
                transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
              }
            : undefined
        }
        className={`relative flex max-h-full flex-col overflow-hidden shadow-card outline-none ${
          isEndDrawer ? "" : ANIMATION_CLASS[placement]
        } ${panelClassName ?? PANEL_CLASS[placement]}`}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
