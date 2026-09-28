import { Outlet } from "react-router-dom";

/**
 * Phone-column shell shared by the mobile attendance screens. This was the
 * Next.js `(mobile)/layout.tsx`; as a route layout it renders the matched child
 * through the outlet.
 */
export function PhoneShell() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-surface sm:border-x sm:border-outline-variant">
      <Outlet />
    </div>
  );
}
