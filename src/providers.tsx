import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { LocaleProvider } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/config";
import { ThemeProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/components/Toast";
import { AppBootLoader } from "@/components/AppBootLoader";

/** Client providers that wrap the app (theme + locale + auth + toasts + boot). */
export function Providers({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  return (
    <ThemeProvider>
      <LocaleProvider initialLocale={initialLocale}>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
          {/* Full-screen loader over everything while the session resolves on boot. */}
          <AppBootLoader />
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
