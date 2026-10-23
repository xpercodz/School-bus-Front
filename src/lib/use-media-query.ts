import { useEffect, useState } from "react";

/**
 * Reactive `matchMedia`. Used for the mobile/desktop split that changes a
 * component's *structure* (centered dialog vs bottom sheet), which CSS alone
 * cannot express. Visual-only breakpoints stay in Tailwind classes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Phone-width layout (below Tailwind's `sm`). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 639px)");
}
