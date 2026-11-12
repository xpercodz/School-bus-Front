/**
 * HOVER HINTS — rest on a control for three seconds and it says what it is.
 *
 * ── WHY A DELAY ─────────────────────────────────────────────────────────────
 * An instant tooltip turns every pointer pass into a flash of text, and the
 * dashboard's rows are wide. Three seconds of stillness is an unambiguous "I am
 * looking at this", so the card only appears for somebody who actually asked.
 *
 * ── WHY THE LISTENER IS ON THE DOCUMENT ─────────────────────────────────────
 * So a control opts in with one attribute (`data-hint="scope"`) and no component
 * has to be wired to an overlay. `closest()` means the innermost annotated
 * element wins, which is what makes a KPI cell inside the summary block answer
 * for itself.
 *
 * ── MOUSE AND KEYBOARD, TOUCH NEVER ─────────────────────────────────────────
 * A phone gets nothing: there is no rest, and a long press belongs to the OS.
 * `(hover: hover) and (pointer: fine)` is checked once, not per event. Keyboard
 * focus starts the same timer, and the card is attached to the control with
 * `aria-describedby` while it is up, so it is not purely a visual feature.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HINT_KEYS, isHintId, type HintId } from "@/lib/hints";
import { useLocale } from "@/lib/i18n/context";

/** The "I am looking at this" threshold. */
const DWELL_MS = 3000;
const TOOLTIP_ID = "hover-hint";
const EDGE = 8;

interface Anchor {
  id: HintId;
  element: HTMLElement;
  top: number;
  left: number;
  width: number;
  height: number;
}

export function HoverHints() {
  const { t } = useLocale();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  /** The control whose card is up (a ref: the listeners are installed once). */
  const shown = useRef<HTMLElement | null>(null);
  const described = useRef<HTMLElement | null>(null);
  const previous = useRef<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const release = useCallback(() => {
    if (described.current !== null) {
      if (previous.current === null) described.current.removeAttribute("aria-describedby");
      else described.current.setAttribute("aria-describedby", previous.current);
    }
    described.current = null;
    previous.current = null;
  }, []);

  const clear = useCallback(() => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
    shown.current = null;
    release();
    setAnchor(null);
    setPos(null);
  }, [release]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const show = (element: HTMLElement) => {
      const id = element.getAttribute("data-hint");
      if (!isHintId(id)) return;
      const rect = element.getBoundingClientRect();
      shown.current = element;
      described.current = element;
      previous.current = element.getAttribute("aria-describedby");
      element.setAttribute(
        "aria-describedby",
        previous.current === null ? TOOLTIP_ID : `${previous.current} ${TOOLTIP_ID}`,
      );
      setAnchor({
        id,
        element,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    /** The annotated element the pointer is over, if any. */
    const aimed = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      const element = target.closest<HTMLElement>("[data-hint]");
      return element;
    };

    const arm = (element: HTMLElement) => {
      if (shown.current === element) return;
      if (shown.current !== null) {
        clear();
      } else if (timer.current !== undefined) {
        window.clearTimeout(timer.current);
        release();
        setPos(null);
      }
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        show(element);
      }, DWELL_MS);
    };

    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const element = aimed(event.target);
      if (element === null) return;
      arm(element);
    };

    /** Leaving the control (not merely moving to a child) cancels the wait. */
    const onOut = (event: PointerEvent) => {
      const element = aimed(event.target);
      if (element === null) return;
      const to = event.relatedTarget;
      if (to instanceof Node && element.contains(to)) return;
      if (shown.current === element) {
        clear();
        return;
      }
      if (timer.current !== undefined) {
        window.clearTimeout(timer.current);
        timer.current = undefined;
      }
    };

    const onFocus = (event: FocusEvent) => {
      const element = aimed(event.target);
      if (element === null) return;
      arm(element);
    };

    const onBlur = () => clear();

    // Any deliberate move — scrolling, clicking, Escape — dismisses it.
    const onScroll = () => clear();
    const onDown = () => clear();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") clear();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      release();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [clear, release]);

  // The card's real height decides whether it sits above or below, so measure
  // before the browser paints.
  useLayoutEffect(() => {
    if (anchor === null || cardRef.current === null) return;
    const card = cardRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const left = Math.min(
      Math.max(EDGE, anchor.left + anchor.width / 2 - card.width / 2),
      vw - card.width - EDGE,
    );
    let top = anchor.top - card.height - EDGE;
    if (top < EDGE) top = Math.min(anchor.top + anchor.height + EDGE, window.innerHeight - card.height - EDGE);
    setPos({ top, left });
  }, [anchor]);

  if (anchor === null) return null;
  const keys = HINT_KEYS[anchor.id];

  return (
    <div
      ref={cardRef}
      id={TOOLTIP_ID}
      role="tooltip"
      data-testid="hover-hint"
      className="hint-in pointer-events-none fixed z-[55] w-[272px] max-w-[calc(100vw-16px)] rounded-lg border border-dash-outline-variant bg-dash-surface p-3 shadow-float"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      <p className="text-[12px] font-semibold leading-5 text-dash-on-surface">
        {t(keys.title)}
      </p>
      <p className="mt-0.5 text-[12.5px] leading-5 text-dash-on-surface-variant">
        {t(keys.body)}
      </p>
    </div>
  );
}
