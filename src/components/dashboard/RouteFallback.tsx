import type { ReactNode } from "react";

/**
 * Loading shell for a lazily-loaded dashboard route. Replaces the per-route
 * Next.js `loading.tsx` files, which all rendered the same wrapper around the
 * skeleton matching the page's own Firebase-query skeleton.
 */
export function RouteFallback({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-6"
    >
      {children}
    </div>
  );
}
