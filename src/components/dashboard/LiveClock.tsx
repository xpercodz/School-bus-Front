import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/context";
import { formatTime } from "@/lib/i18n/format";

/**
 * Live clock for the dashboard header.
 *
 * Ticks every second and renders a locale-aware time (12-hour with Eastern
 * Arabic digits + ص/م for ar). Hydration-safe: the client starts with
 * `now === null` (matching the server's first paint of "--:--:--") and only
 * begins ticking after mount. Decorative, so no aria-live — it would announce
 * every second to screen readers.
 */
export function LiveClock() {
  const { locale } = useLocale();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-sm tabular-nums text-dash-on-surface-variant">
      {now ? formatTime(now, locale) : "--:--:--"}
    </span>
  );
}
