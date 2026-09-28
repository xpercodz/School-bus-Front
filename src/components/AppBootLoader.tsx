import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/context";
import { BanterLoader } from "./BanterLoader";

/**
 * Full-screen splash (the banter loader) shown while Firebase resolves the
 * signed-in session on boot. This covers the cold-start window: before the
 * session is known the app can't tell login from dashboard, so a branded
 * loader is shown instead of flashing the login page or the "Live data
 * unavailable" notice. Removed the moment the session resolves.
 */
export function AppBootLoader() {
  const { status } = useAuth();
  const { t } = useLocale();
  if (status !== "loading") return null;

  return (
    <div className="fixed inset-0 z-[200] bg-primary">
      <BanterLoader label={t("common.loading")} />
    </div>
  );
}
