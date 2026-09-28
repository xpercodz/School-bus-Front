import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { RequireRole } from "@/components/RequireRole";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { activeIdFromPathname } from "@/data/dashboard";
import { useSchoolName } from "@/lib/school";

/**
 * Director-only shell for /dashboard (and its sub-pages): guards access
 * (redirects to /login or / by role), then renders the sidebar + sticky top
 * bar. The active sidebar item follows the current path; the school name comes
 * from the signed-in user's tenant so each school sees its own. On desktop
 * (≥lg) the sidebar is a fixed rail; below that it's an off-canvas drawer
 * opened from the top bar's hamburger.
 */
export function DirectorShell({ children }: { children: ReactNode }) {
  const schoolName = useSchoolName();
  const { pathname } = useLocation();
  const activeId = activeIdFromPathname(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the drawer when the viewport crosses up to desktop, so an open
  // drawer can never overlay the fixed sidebar after a resize. (The drawer
  // only opens below lg, so no initial sync check is needed.)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setSidebarOpen(false);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Close the drawer on route change (nav clicks close it via Sidebar; this
  // also covers browser back/forward). Adjusting state during render is the
  // documented "respond to a prop change" pattern — not an effect.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setSidebarOpen(false);
  }

  return (
    <RequireRole role="director" fallback="/">
      <div className="min-h-dvh bg-dash-background font-sans text-dash-on-surface">
        <Sidebar
          activeId={activeId}
          schoolName={schoolName}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="ms-0 flex min-h-dvh flex-col lg:ms-64 print:ms-0">
          <TopBar
            onOpenNav={() => setSidebarOpen(true)}
            navOpen={sidebarOpen}
          />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </RequireRole>
  );
}
