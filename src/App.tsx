import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { DirectorShell } from "@/components/dashboard/DirectorShell";
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
import LoginPage from "@/routes/LoginPage";
import MobilePage from "@/routes/MobilePage";
import { PhoneShell } from "@/routes/PhoneShell";

// The director pages are code-split. Each lazy import is paired below with the
// same skeleton the page shows while its Firebase query is in flight, which is
// what the removed Next.js `loading.tsx` files used to render.
const DashboardPage = lazy(() => import("@/routes/DashboardPage"));
const ReportsPage = lazy(() => import("@/routes/ReportsPage"));
const AssignmentsPage = lazy(() => import("@/routes/AssignmentsPage"));
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

function AppRoutes() {
  return (
    <Routes>
      {/* Mobile roster — the phone-column shell. */}
      <Route element={<PhoneShell />}>
        <Route index element={<MobilePage />} />
      </Route>

      <Route path="/login" element={<LoginPage />} />

      {/* Director area. DirectorShell is the role guard + sidebar + top bar. */}
      <Route
        path="/dashboard"
        element={
          <DirectorShell>
            <Outlet />
          </DirectorShell>
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
