"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, FocusEvent, KeyboardEvent, ReactNode } from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Check, Search } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./dropdown-menu.module.css";

export interface DropdownItem { label: string; onSelect?: () => void; disabled?: boolean; icon?: ReactNode; destructive?: boolean; separatorBefore?: boolean; /** Marks the current value in a value selector (a trailing check). */ checked?: boolean; /** A right-hand value on the row — a count in a class/bus picker. */ meta?: string; }
export interface DropdownMenuProps {
  /** The trigger's visible label — for a value selector, the current value. Omit for an icon-only trigger. */
  label?: string;
  items: DropdownItem[];
  icon?: ReactNode;
  /** Accessible name for an icon-only trigger. */
  ariaLabel?: string;
  /** Which edge the menu aligns to. Value selectors usually align `start`. */
  align?: "start" | "center" | "end";
  disabled?: boolean;
  /** Classes for the trigger only — `w-full`, `h-11`, `arc-field`. Display utilities cannot win against the module. */
  triggerClassName?: string;
  /** Make the menu at least as wide as its trigger (a full-width select). */
  matchTriggerWidth?: boolean;
  /** A short trailing value in the trigger, after the label — e.g. a class count. */
  badge?: string;
  /** Renders a text field at the top of the menu that filters the items by label. */
  searchable?: { placeholder: string; emptyLabel: string };
}

type Highlight = { top: number; height: number; danger: boolean; glide: boolean };

/** A new trigger label rises in while the old one leaves, and the trigger width springs to the measured text instead of snapping. */
function TriggerLabel({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const measure = useRef<HTMLSpanElement>(null);
  const measured = useRef<string | null>(null);
  const [size, setSize] = useState<{ width: number | "auto"; animate: boolean }>({ width: "auto", animate: false });
  useLayoutEffect(() => {
    const node = measure.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const current = node.textContent;
      // Only a text change morphs; the first measure and font swaps settle instantly.
      const animate = measured.current !== null && measured.current !== current;
      measured.current = current;
      setSize({ width: Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth), animate });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <motion.span className={styles.label} initial={false} animate={{ width: size.width }} transition={size.animate && !reduced ? motionTokens.spring.morph : { duration: 0 }}>
    <span ref={measure} className={styles.labelMeasure} aria-hidden="true">{text}</span>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={text} className={styles.labelText} initial={reduced ? false : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.3em", filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }} transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}>{text}</motion.span>
    </AnimatePresence>
  </motion.span>;
}

export function DropdownMenu({ label, items, icon, ariaLabel, align = "end", disabled, triggerClassName, matchTriggerWidth, badge, searchable }: DropdownMenuProps) {
  const reduced = useReducedMotion();
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const pointer = useRef(false);
  const clearTimer = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Only the searchable menu owns a query; the menu unmounts its content on
  // close, so the raw label list is never filtered by a stale value.
  const [query, setQuery] = useState("");
  useEffect(() => () => window.clearTimeout(clearTimer.current), []);
  // Radix focuses the highlighted item (pointer or keyboard) and the content when the pointer leaves an item.
  function onMenuFocus(event: FocusEvent<HTMLDivElement>) {
    // A searchable menu opens on its field, not on the content: the content is
    // focused first (Radix's mount autofocus), so hand focus straight to the
    // search input. Item focus still bubbles through here unchanged.
    if (searchable && event.target === event.currentTarget) {
      searchRef.current?.focus({ preventScroll: true });
      return;
    }
    const item = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[role="menuitem"]') : null;
    window.clearTimeout(clearTimer.current);
    if (!item) {
      // A short grace period keeps the highlight gliding across separators and item gaps.
      clearTimer.current = window.setTimeout(() => setHighlight(null), pointer.current ? 70 : 0);
      return;
    }
    const next = { top: item.offsetTop, height: item.offsetHeight, danger: item.dataset.tone === "danger" };
    const glide = pointer.current;
    setHighlight(current => ({ ...next, glide: glide && current !== null }));
  }
  const needle = query.trim().toLocaleLowerCase();
  const visibleItems = searchable && needle
    ? items.filter(item => item.label.toLocaleLowerCase().includes(needle))
    : items;
  function firstItem(): HTMLElement | null {
    return contentRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])') ?? null;
  }
  // The field owns every keystroke: Radix's menu typeahead focuses the first
  // item whose label matches, so a printable character must not reach the
  // content's key handler, or the first letter typed would steal focus.
  // ArrowDown is the one exception — it leaves the field for the first row.
  // Escape is left alone so the dismissable layer closes the menu.
  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      firstItem()?.focus();
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) event.stopPropagation();
  }
  // A searchable menu opens on the field, not the content; Radix's default
  // focuses the content so the arrow keys can walk the rows. The content's
  // onFocus handler (above) moves that focus into the field.
  // An icon-only trigger carries its name in aria-label and drops the chevron; a labelled one shows the current value.
  const labelled = label !== undefined && label !== "";
  const hasBadge = badge !== undefined && badge !== "";
  return <DropdownPrimitive.Root onOpenChange={open => { if (open) { window.clearTimeout(clearTimer.current); setHighlight(null); setQuery(""); } }}>
    <DropdownPrimitive.Trigger type="button" disabled={disabled} aria-label={ariaLabel} className={[styles.trigger, labelled ? "" : styles.iconTrigger, triggerClassName].filter(Boolean).join(" ")}>{icon && <span className={styles.triggerIcon} aria-hidden="true">{icon}</span>}{labelled && <TriggerLabel text={label}/>}{hasBadge && <span style={{ flex: "none", display: "inline-flex", minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", padding: "0 6px", borderRadius: "var(--radius-pill)", background: "var(--surface-muted)", color: "var(--text-secondary)", fontSize: "var(--text-xs)", fontVariantNumeric: "tabular-nums" }}>{badge}</span>}{labelled && <ChevronDown className={styles.chevron} size={15} strokeWidth={1.8} aria-hidden="true"/>}</DropdownPrimitive.Trigger>
    <DropdownPrimitive.Portal><DropdownPrimitive.Content ref={contentRef} className={styles.menu} aria-label={ariaLabel} data-match-trigger={matchTriggerWidth ? "" : undefined} sideOffset={6} align={align} collisionPadding={12} loop onFocus={onMenuFocus} onPointerMoveCapture={() => { pointer.current = true; }} onKeyDownCapture={() => { pointer.current = false; }}>
      {/* One highlight glides between items for the pointer and jumps instantly for the keyboard. */}
      <motion.span className={styles.highlight} data-tone={highlight?.danger ? "danger" : undefined} aria-hidden="true" initial={false} animate={highlight ? { y: highlight.top, height: highlight.height, opacity: 1 } : { opacity: 0 }} transition={{ default: highlight?.glide && !reduced ? motionTokens.spring.snappy : { duration: 0 }, opacity: { duration: reduced ? 0 : .08 } }}/>
      {searchable && <div style={{ position: "sticky", top: -5, zIndex: 1, margin: "-5px -5px 4px", padding: "5px 5px 6px", background: "var(--surface-raised)", borderBottom: "1px solid var(--border-subtle)" }}>
        <span style={{ position: "relative", display: "block" }}>
          <Search size={15} strokeWidth={1.8} aria-hidden="true" style={{ position: "absolute", top: "50%", insetInlineStart: 9, transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}/>
          <input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={onSearchKeyDown} placeholder={searchable.placeholder} aria-label={searchable.placeholder} autoComplete="off" spellCheck={false} className={styles.search}/>
        </span>
      </div>}
      {visibleItems.map((item, index) => <Fragment key={item.label}>{item.separatorBefore && <DropdownPrimitive.Separator className={styles.separator}/>}<DropdownPrimitive.Item className={[styles.item, item.destructive ? styles.destructive : ""].filter(Boolean).join(" ")} data-tone={item.destructive ? "danger" : undefined} style={{ "--i": index } as CSSProperties} disabled={item.disabled} onSelect={searchable ? () => { setQuery(""); item.onSelect?.(); } : item.onSelect}>{item.icon && <span className={styles.icon} aria-hidden="true">{item.icon}</span>}{item.label}{item.meta && <span style={{ marginInlineStart: "auto", flex: "none", color: "var(--text-muted)", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>{item.meta}</span>}{item.checked && <Check className={styles.check} style={item.meta ? { marginInlineStart: 0 } : undefined} size={15} strokeWidth={2} aria-hidden="true"/>}</DropdownPrimitive.Item></Fragment>)}
      {searchable && visibleItems.length === 0 && <p role="presentation" style={{ margin: 0, padding: "10px 11px", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>{searchable.emptyLabel}</p>}
    </DropdownPrimitive.Content></DropdownPrimitive.Portal>
  </DropdownPrimitive.Root>;
}

export default DropdownMenu;
