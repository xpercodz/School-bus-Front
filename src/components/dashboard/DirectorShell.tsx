import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { RequireAccess } from "@/components/RequireAccess";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { HelpDialog } from "@/components/dashboard/HelpDialog";
import { SettingsDrawer } from "@/components/dashboard/SettingsDrawer";
import { TourHost } from "@/components/dashboard/Tour";
import { activeIdFromPathname } from "@/data/dashboard";
import { useSchoolName } from "@/lib/school";

/**
 * Management shell for /dashboard and its sub-pages: the signed-in access guard
 * (a director, or an operator with at least one screen), a labelled desktop
 * rail, a phone header with a nav drawer, and the shared Help/Settings dialogs.
 * Dialogs live here (not inside the rail) so opening Settings from the mobile
 * drawer does not unmount it when the drawer closes.
 *
 * The shell admits the whole management surface; each ROUTE is gated again by
 * `RequireScreen`, which is what actually denies an operator a page they were
 * not granted.
 */
export function DirectorShell({ children }: { children: ReactNode }) {
  const schoolName = useSchoolName();
  const { pathname } = useLocation();
  const activeId = activeIdFromPathname(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Close the drawer when the viewport crosses up to desktop, so an open
  // drawer can never overlay the fixed sidebar after a resize.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setSidebarOpen(false);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Close the drawer on route change (nav clicks close it via Sidebar; this
  // also covers browser back/forward).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setSidebarOpen(false);
  }

  return (
    <RequireAccess>
      {/* TourHost owns the one-time invitation and the tour itself. It lives
          INSIDE RequireAccess because the tour reads `useMainDirector`, which
          that gate provides. */}
      <TourHost>
      <div className="min-h-dvh bg-dash-background font-sans text-dash-on-surface">
        <Sidebar
          activeId={activeId}
          schoolName={schoolName}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <div className="flex min-h-dvh flex-col lg:ms-[236px] print:ms-0">
          <TopBar
            onOpenNav={() => setSidebarOpen(true)}
            navOpen={sidebarOpen}
            schoolName={schoolName}
          />
          {/* Keyed by route so each screen arrives once with the shared
              page-enter animation; the bottom bar owns its own space. */}
          <main
            key={pathname}
            className="page-enter flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0"
          >
            {children}
          </main>
        </div>

        <MobileNav />

        <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
        <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
      </TourHost>
    </RequireAccess>
  );
}
