import { useRef, type KeyboardEvent } from "react";
import { useLocale } from "@/lib/i18n/context";

export interface SlideSegmentOption<T extends string> {
  id: T;
  label: string;
}

type Variant = "pill" | "box" | "dash-box";

interface SlideSegmentsProps<T extends string> {
  options: readonly SlideSegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Screen-reader name for the group (e.g. "choose sign-in mode"). */
  ariaLabel: string;
  /** pill = mobile rounded-full track (login mode); box = mobile rectangular
   *  with border (dispatch run type); dash-box = dashboard palette rectangular
   *  (run-segment filter). */
  variant?: Variant;
}

const TRACK_CLASS: Record<Variant, string> = {
  pill: "h-11 overflow-hidden rounded-md border border-outline-variant bg-surface-container-high p-0.5",
  box: "h-11 overflow-hidden rounded-md border border-outline-variant bg-surface p-0.5",
  "dash-box":
    "h-10 overflow-hidden rounded-md border border-dash-outline-variant bg-dash-surface-container-low p-0.5 sm:h-9",
};

const THUMB_CLASS: Record<Variant, string> = {
  pill: "rounded border border-outline-variant bg-surface-container-lowest",
  box: "rounded bg-primary-container",
  "dash-box": "rounded bg-dash-surface",
};

const LABEL_CLASS: Record<Variant, string> = {
  pill: "text-[13.5px]",
  box: "text-label-lg",
  "dash-box": "text-[12.5px]",
};

const ACTIVE_CLASS: Record<Variant, string> = {
  pill: "text-on-surface font-medium",
  box: "text-on-primary-container font-medium",
  "dash-box": "text-dash-on-surface font-medium",
};

const IDLE_CLASS: Record<Variant, string> = {
  pill: "text-on-surface-variant hover:text-on-surface",
  box: "text-on-surface-variant hover:text-on-surface",
  "dash-box": "text-dash-on-surface-variant hover:text-dash-on-surface",
};

const RING_CLASS: Record<Variant, string> = {
  pill: "focus-visible:ring-primary",
  box: "focus-visible:ring-primary",
  "dash-box": "focus-visible:ring-dash-primary",
};

/**
 * Segmented control with a sliding thumb: options sit in a static row and a
 * single highlighted thumb translates underneath the active option (one-shot
 * CSS transition — it slides exactly once per selection change, and the
 * direction mirrors in RTL). Equal-width options are assumed (flex-1 row), so
 * the thumb is `1/N` of the inner track width and moves by its own width per
 * step — no measuring needed.
 *
 * Keyboard: WAI-ARIA roving tabindex + arrow/Home/End navigation, with arrow
 * direction inverted in RTL so Left always means "back" visually.
 */
export function SlideSegments<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  variant = "pill",
}: SlideSegmentsProps<T>) {
  const { dir } = useLocale();
  const refs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const rtl = dir === "rtl";
  const index = Math.max(0, options.findIndex((option) => option.id === value));
  // translateX % refers to the thumb's OWN width — one step == one thumb width.
  const thumbTransform =
    index === 0 ? "translateX(0)" : rtl ? `translateX(-${index * 100}%)` : `translateX(${index * 100}%)`;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    let next = -1;
    if (event.key === forward) next = (index + 1) % options.length;
    else if (event.key === backward) next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const target = options[next];
    onChange(target.id);
    refs.current.get(target.id)?.focus();
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`relative flex items-stretch ${TRACK_CLASS[variant]}`}
    >
      {/* Sliding highlight thumb. z-0 under the option buttons. */}
      <div
        aria-hidden="true"
        className={`absolute start-0.5 top-0.5 bottom-0.5 ${THUMB_CLASS[variant]}`}
        style={{
          width: `calc((100% - 4px) / ${Math.max(1, options.length)})`,
          transform: thumbTransform,
          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
      {options.map((option) => {
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isActive}
            tabIndex={isActive ? 0 : -1}
            ref={(el) => {
              refs.current.set(option.id, el);
            }}
            onClick={() => onChange(option.id)}
            className={`relative z-[1] h-full min-w-0 flex-1 overflow-hidden px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 ${RING_CLASS[variant]} ${LABEL_CLASS[variant]} ${
              isActive ? ACTIVE_CLASS[variant] : IDLE_CLASS[variant]
            }`}
          >
            <span className="flex h-full items-center justify-center whitespace-nowrap">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
