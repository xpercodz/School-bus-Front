import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";


import {
  AssignmentsSkeleton,
  DriversSkeleton,
  LiveMapSkeleton,
  ReportsSkeleton,
} from "@/components/dashboard/DashboardSkeletons";
import { RouteFallback } from "@/components/dashboard/RouteFallback";
import { RequireScreen } from "@/components/RequireAccess";
import { readLocaleCookie } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/types";
import { Providers } from "@/providers";
import MobilePage from "@/routes/MobilePage";
import { PhoneShell } from "@/routes/PhoneShell";

// The director pages are code-split. Each lazy import is paired below with the
// same skeleton the page shows while its Firebase query is in flight, which is
// what the removed Next.js `loading.tsx` files used to render.
// Login is code-split too: its OTP field and its Arc controls carry the
// animation runtime, and login is not every user's first paint.
const LoginPage = lazy(() => import("@/routes/LoginPage"));
// The director shell (rail, top bar, role guard) is code-split so a driver never
// downloads the directorship's chrome. NOTE: the roster renders Arc Buttons too,
// so `motion` is reachable from the entry as well — see the measured note in
// AGENTS.md before treating the entry load as motion-free.
const DirectorShell = lazy(() =>
  import("@/components/dashboard/DirectorShell").then((module) => ({
    default: module.DirectorShell,
  })),
);
const DashboardPage = lazy(() => import("@/routes/DashboardPage"));
const StudentsPage = lazy(() => import("@/routes/StudentsPage"));
const ReportsPage = lazy(() => import("@/routes/ReportsPage"));
const AssignmentsPage = lazy(() => import("@/routes/AssignmentsPage"));
// TEMPORARY: the review page for the Arc Registry component changes. The import
// itself is gated (not just the route) because a bare `lazy(() => import(...))`
// still emits a chunk in a production build — which the service worker would
// then precache for a page that cannot be routed to.
const PreviewPage = import.meta.env.DEV
  ? lazy(() => import("@/routes/PreviewPage"))
  : null;
const DriversPage = lazy(() => import("@/routes/DriversPage"));
const OperatorsPage = lazy(() => import("@/routes/OperatorsPage"));
const ActivityPage = lazy(() => import("@/routes/ActivityPage"));
// The guidebook is its own manual: lazy so a driver and a dispatch-only session
// never download it.
const GuidePage = lazy(() => import("@/routes/GuidePage"));

/**
 * Per-route document title/description. The Next.js layouts did this with
 * `generateMetadata`; a SPA has to set it from the client, so this mirrors the
 * old mapping exactly (dashboard area -> dashboard title, login -> root meta,
 * everything else -> mobile title).
 */
function DocumentMeta() {
  const { pathname } = useLocation();
  const { t } = useLocale();

  useEffect(() => {
    let titleKey: MessageKey = "meta.mobileTitle";
    let descriptionKey: MessageKey = "meta.mobileDescription";

    if (pathname.startsWith("/dashboard")) {
      titleKey = "meta.dashboardTitle";
      descriptionKey = "meta.dashboardDescription";
    } else if (pathname.startsWith("/login")) {
      titleKey = "meta.title";
      descriptionKey = "meta.description";
    }

    document.title = t(titleKey);
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t(descriptionKey));
  }, [pathname, t]);

  return null;
}

/** Shown for the few hundred ms the login chunk takes; matches its layout so nothing jumps. */
function LoginFallback() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface px-4 py-6">
      <div className="m-auto h-[420px] w-full max-w-[400px] animate-pulse rounded-2xl bg-surface-container" />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Mobile roster — the phone-column shell. */}
      <Route element={<PhoneShell />}>
        <Route index element={<MobilePage />} />
      </Route>

      <Route
        path="/login"
        element={
          <Suspense fallback={<LoginFallback />}>
            <LoginPage />
          </Suspense>
        }
      />

      {/* TEMPORARY review route for the Arc Registry components. Guarded by
          import.meta.env.DEV so a production build can never serve it. */}
      {PreviewPage && (
        <Route
          path="/preview"
          element={
            <Suspense fallback={null}>
              <PreviewPage />
            </Suspense>
          }
        />
      )}

      {/* Management area. DirectorShell is the signed-in access guard + sidebar
          + top bar; each route is gated AGAIN by RequireScreen, so an operator
          who lacks that screen is redirected to one they hold. */}
      <Route
        path="/dashboard"
        element={
          <Suspense
            fallback={
              <div className="min-h-dvh bg-dash-background" aria-busy="true" />
            }
          >
            <DirectorShell>
              <Outlet />
            </DirectorShell>
          </Suspense>
        }
      >
        <Route
          index
          element={
            <RequireScreen screen="live">
              <Suspense
                fallback={
                  <RouteFallback>
                    <LiveMapSkeleton />
                  </RouteFallback>
                }
              >
                <DashboardPage />
              </Suspense>
            </RequireScreen>
          }
        />
        <Route
          path="students"
          element={
            <RequireScreen screen="students">
              <Suspense
                fallback={
                  <RouteFallback>
                    <LiveMapSkeleton />
                  </RouteFallback>
                }
              >
                <StudentsPage />
              </Suspense>
            </RequireScreen>
          }
        />
        <Route
          path="reports"
          element={
            <RequireScreen screen="reports">
              <Suspense
                fallback={
                  <RouteFallback>
                    <ReportsSkeleton />
                  </RouteFallback>
                }
              >
                <ReportsPage />
              </Suspense>
            </RequireScreen>
          }
        />
        <Route
          path="assignments"
          element={
            <RequireScreen screen="assignments">
              <Suspense
                fallback={
                  <RouteFallback>
                    <AssignmentsSkeleton />
                  </RouteFallback>
                }
              >
                <AssignmentsPage />
              </Suspense>
            </RequireScreen>
          }
        />
        <Route
          path="drivers"
          element={
            <RequireScreen screen="drivers">
              <Suspense
                fallback={
                  <RouteFallback>
                    <DriversSkeleton />
                  </RouteFallback>
                }
              >
                <DriversPage />
              </Suspense>
            </RequireScreen>
          }
        />
        <Route
          path="activity"
          element={
            <RequireScreen screen="activity">
              <Suspense
                fallback={
                  <RouteFallback>
                    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 p-4 sm:p-6">
                      <div className="h-9 w-48 animate-pulse rounded-md bg-dash-surface-container" />
                      <div className="h-20 animate-pulse rounded-lg border border-dash-outline-variant bg-dash-surface" />
                      <div className="h-72 animate-pulse rounded-lg border border-dash-outline-variant bg-dash-surface" />
                    </div>
                  </RouteFallback>
                }
              >
                <ActivityPage />
              </Suspense>
            </RequireScreen>
          }
        />
        {/* Main director only: the page is the one place access is handed out. */}
        <Route
          path="operators"
          element={
            <RequireScreen screen="operators">
              <Suspense
                fallback={
                  <RouteFallback>
                    <ReportsSkeleton />
                  </RouteFallback>
                }
              >
                <OperatorsPage />
              </Suspense>
            </RequireScreen>
          }
        />
        {/* The guidebook is documentation, not a privilege: every reader the
            shell admits may open it, so it is gated by the shell alone. Its own
            contents are filtered by what the reader can open. */}
        <Route
          path="guide"
          element={
            <Suspense
              fallback={
                <RouteFallback>
                  <ReportsSkeleton />
                </RouteFallback>
              }
            >
              <GuidePage />
            </Suspense>
          }
        />
        {/* Analytics was merged into Reports and now opens as a modal there.
            The standalone route survives as a redirect, as it did in
            next.config.ts. */}
        <Route
          path="analytics"
          element={<Navigate to="/dashboard/reports" replace />}
        />
      </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      {/* The locale cookie is read before first render so an Arabic user never
          sees a flash of LTR English (the old server layout read it in SSR). */}
      <Providers initialLocale={readLocaleCookie()}>
        <DocumentMeta />
        <AppRoutes />
      </Providers>
    </BrowserRouter>
  );
}
