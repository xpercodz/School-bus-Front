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

      {/* Director area. DirectorShell is the role guard + sidebar + top bar. */}
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
            <Suspense
              fallback={
                <RouteFallback>
                  <LiveMapSkeleton />
                </RouteFallback>
              }
            >
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="reports"
          element={
            <Suspense
              fallback={
                <RouteFallback>
                  <ReportsSkeleton />
                </RouteFallback>
              }
            >
              <ReportsPage />
            </Suspense>
          }
        />
        <Route
          path="assignments"
          element={
            <Suspense
              fallback={
                <RouteFallback>
                  <AssignmentsSkeleton />
                </RouteFallback>
              }
            >
              <AssignmentsPage />
            </Suspense>
          }
        />
        <Route
          path="drivers"
          element={
            <Suspense
              fallback={
                <RouteFallback>
                  <DriversSkeleton />
                </RouteFallback>
              }
            >
              <DriversPage />
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
