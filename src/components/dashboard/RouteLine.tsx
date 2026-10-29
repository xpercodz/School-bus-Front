import type { CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { useLocale } from "@/lib/i18n/context";

/** One width/offset transition for the route line and the bead that rides it. */
const ROUTE_MOTION =
  "duration-[var(--t-data)] ease-[var(--ease-out-soft)] motion-reduce:transition-none";

interface RouteLineProps {
  /** Percent of the route completed (0–100; clamped here). */
  progress: number;
  /** A finished run draws grey and stops the travelling highlight. */
  completed: boolean;
  /** Row index, so several live lines read as one wave crossing the screen. */
  sweepRow?: number;
  /** Whether the highlight runs. Defaults to the inverse of `completed`. */
  live?: boolean;
}

/**
 * One run's position on its route: the track, the travelled part, the bead, and
 * while the run is live the travelling highlight (`.route-flow` in
 * globals.css). Shared by the live-monitor fleet rows and the bus overview
 * modal, so the row and the modal it opens can never disagree about progress.
 *
 * Decorative: the percentage is always rendered as text beside it.
 */
export function RouteLine({
  progress,
  completed,
  sweepRow = 0,
  live = !completed,
}: RouteLineProps) {
  const { dir } = useLocale();
  const clamped = Math.min(100, Math.max(0, progress));
  // The bead is centred on its point. `translate(-50%)` is physical, so in RTL
  // it skated half a bead to the wrong side of the route mark; mirror it.
  const beadShift = dir === "rtl" ? "translate(50%, -50%)" : "translate(-50%, -50%)";

  return (
    <div className="relative mt-2 h-5" aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-dash-surface-container-high" />
      <span
        className={`absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full ${
          completed ? "bg-dash-outline" : "bg-dash-primary"
        } transition-[width] ${ROUTE_MOTION}`}
        style={{ width: `${clamped}%` }}
      />
      {/* The travelling highlight rides only the travelled part of a live line;
          a finished run rests. */}
      {live && clamped > 0 && (
        <span
          className="route-flow absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
          style={{ width: `${clamped}%`, "--sweep-row": sweepRow } as CSSProperties}
          aria-hidden="true"
        />
      )}
      <span
        className={`absolute top-1/2 flex h-5 w-5 items-center justify-center rounded-full ${
          completed
            ? "border border-dash-outline bg-dash-surface text-dash-outline"
            : "bg-dash-primary text-dash-on-primary"
        } transition-[inset-inline-start] ${ROUTE_MOTION}`}
        style={{
          // Clamped so a 0% or 100% bead still sits fully inside
          // the line instead of hanging over the card edge.
          insetInlineStart: `clamp(10px, ${clamped}%, calc(100% - 10px))`,
          transform: beadShift,
        }}
      >
        <Icon name="directions_bus" size={12} variant="outlined" />
      </span>
    </div>
  );
}
