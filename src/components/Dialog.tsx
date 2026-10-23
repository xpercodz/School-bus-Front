import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { prefersReducedMotion } from "@/lib/theme";
import { useIsMobile } from "@/lib/use-media-query";

type Placement = "center" | "bottom" | "end";
/** `auto` = centered dialog on desktop, bottom sheet on a phone. */
type RequestedPlacement = Placement | "auto";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Localized title; also the panel's aria-label. */
  title?: string;
  /**
   * center = modal, bottom = sheet, end = inline-end drawer.
   * `auto` (default) turns the modal into a thumb-reachable bottom sheet below
   * 640px while keeping the centered dialog on desktop.
   */
  placement?: RequestedPlacement;
  /** false makes the overlay non-dismissable (Escape/backdrop ignored). */
  dismissable?: boolean;
  /**
   * Set false when the caller unmounts its body as soon as `open` flips (a
   * form fetched per open). The panel would otherwise slide out empty; those
   * dialogs close instantly instead.
   */
  exitAnimation?: boolean;
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
  center:
    "items-center justify-center overflow-y-auto overflow-x-hidden p-4 sm:p-6",
  bottom: "flex-col justify-end overflow-y-auto overflow-x-hidden",
  end: "justify-end overflow-hidden",
};

const PANEL_CLASS: Record<Placement, string> = {
  center: "w-full max-w-md max-h-full rounded-xl bg-surface",
  bottom:
    "w-full max-w-lg max-h-[88dvh] rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] sm:rounded-t-xl",
  end: "h-full w-80 max-w-[90vw] border-s border-outline-variant bg-surface",
};

/** Exit timing per placement — leaving is shorter than arriving. */
const EXIT_MS: Record<Placement, number> = {
  center: 160,
  bottom: 220,
  end: 320,
};

// End drawers do NOT use keyframe entries: they unfold like an accordion
// through an inline transform transition (scaleX hinged at the screen edge),
// which proved stable where keyframe/translate entries trembled or jumped on
// some engines. Center modals and bottom sheets animate with the shared
// dlg-panel-* / dlg-sheet-* keyframes in globals.css.
const ANIMATION_CLASS: Record<Placement, { in: string; out: string }> = {
  center: { in: "dlg-panel-in", out: "dlg-panel-out" },
  bottom: { in: "dlg-sheet-in", out: "dlg-sheet-out" },
  end: { in: "", out: "" },
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
 * Renders a fixed backdrop + panel that opens with a short entrance and stays
 * mounted for one exit beat when it closes. The body is scroll-locked while
 * open, focus moves into the panel and is trapped (Tab cycles within it), and
 * Escape / backdrop click close the *topmost* open dialog (unless
 * non-dismissable). Uses the mobile (default) palette so it renders identically
 * on both sections; RTL-safe via logical utilities.
 */
export function Dialog({
  open,
  onClose,
  title,
  placement = "auto",
  dismissable = true,
  exitAnimation = true,
  panelClassName,
  children,
}: DialogProps) {
  const isMobile = useIsMobile();
  const resolvedPlacement: Placement =
    placement === "auto" ? (isMobile ? "bottom" : "center") : placement;
  const isEndDrawer = resolvedPlacement === "end";
  const animation = ANIMATION_CLASS[resolvedPlacement];
  const exitMs = EXIT_MS[resolvedPlacement];
  // Read at render: an end drawer under reduced motion is simply there, never
  // unfolded. The CSS class below also removes the inline transition.
  const reducedMotion = prefersReducedMotion();

  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without re-running the open-effect on every render.
  const onCloseRef = useRef(onClose);
  const isOpenRef = useRef(open);
  useEffect(() => {
    onCloseRef.current = onClose;
    isOpenRef.current = open;
  }, [open, onClose]);

  // ── Mount/exit state ──────────────────────────────────────────────────────
  // A closed dialog stays mounted for one short exit beat so the fade/slide
  // can finish; reduced motion removes it immediately.
  const [mounted, setMounted] = useState(open);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setExiting(false);
      return;
    }
    if (!mounted) return;
    if (prefersReducedMotion() || !exitAnimation) {
      setMounted(false);
      setExiting(false);
      return;
    }
    setExiting(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [open, mounted, exitMs, exitAnimation]);

  // End drawers unfold with an inline transition: paint the collapsed state
  // first, then flip `entered` on the next frame. On exit it collapses back to
  // the hinge while the panel is still mounted.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!isEndDrawer) return;
    if (!mounted || exiting) {
      setEntered(false);
      return;
    }
    if (prefersReducedMotion()) {
      setEntered(true);
      return;
    }
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isEndDrawer, mounted, exiting]);

  // ── Open behaviour: stack, focus, scroll lock, Escape/Tab ─────────────────
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

  if (!mounted && !open) return null;

  // Rendered through a portal to <body> so the overlay escapes any parent
  // stacking context (e.g. the sticky z-10 top bar or the z-20 sidebar) and
  // truly sits at z-80 above everything, dimming the whole screen behind the
  // panel. Safe for SSR: `open` is always false on the server.
  // While leaving, the overlay must not swallow a click meant for the page
  // underneath: it is visually fading, so it must stop being a target.
  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex ${WRAPPER_CLASS[resolvedPlacement]} ${
        exiting ? "pointer-events-none" : ""
      }`}
      data-state={exiting ? "closing" : "open"}
    >
      <div
        aria-hidden="true"
        className={`fixed inset-0 bg-[var(--overlay)] print:hidden ${
          exiting ? "dlg-backdrop-out" : "dlg-fade-in"
        } ${dismissable ? "cursor-pointer" : ""}`}
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
                transform:
                  (entered || reducedMotion) && !exiting
                    ? "scaleX(1)"
                    : "scaleX(0)",
                transformOrigin:
                  typeof document !== "undefined" && document.documentElement.dir === "rtl"
                    ? "left center"
                    : "right center",
                transition: "transform var(--t-enter) var(--ease-out-soft)",
              }
            : undefined
        }
        className={`relative flex flex-col overflow-hidden outline-none ${
          isEndDrawer ? "dlg-end-panel" : "shadow-float"
        } ${isEndDrawer ? "" : exiting ? animation.out : animation.in} ${
          panelClassName ?? PANEL_CLASS[resolvedPlacement]
        }`}
      >
        {resolvedPlacement === "bottom" && <div className="sheet-handle" aria-hidden="true" />}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
