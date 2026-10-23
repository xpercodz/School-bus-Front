import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/theme";

interface AnimatedNumberProps {
  value: number;
  /** Formats an intermediate integer — usually `toLocaleDigits(String(n), locale)`. */
  format: (value: number) => string;
  /** Tween length in ms; defaults to the --t-data bucket (500ms). */
  duration?: number;
  className?: string;
}

/**
 * A count that travels to its new value instead of snapping. Used for the run
 * totals and the dashboard KPI cells, where a change is the thing worth
 * noticing. The final value is always exposed to assistive tech (the animating
 * digits are aria-hidden), and reduced motion prints the value immediately.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 500,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(() =>
    prefersReducedMotion() ? value : 0,
  );
  const displayRef = useRef(display);
  displayRef.current = display;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const from = displayRef.current;
    if (from === value) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // Ease-out cubic: quick to leave the old value, settles on the new one.
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (value - from) * eased);
      setDisplay(progress < 1 ? next : value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span className={className}>
      <span aria-hidden="true">{format(display)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
