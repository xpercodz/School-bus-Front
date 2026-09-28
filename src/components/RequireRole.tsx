import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useUserProfile, type UserRole } from "@/lib/user-profile";
import { useLocale } from "@/lib/i18n/context";

interface RequireRoleProps {
  /** The role allowed to see this area. */
  role: UserRole;
  /** Where to send an authenticated user who has the wrong role. */
  fallback: string;
  children: ReactNode;
}

/**
 * Client-side route guard: renders children only for an authenticated user
 * whose profile matches `role`. Signed-out users are sent to /login; wrong-role
 * users to `fallback`. Renders nothing (and lets the redirect run) otherwise.
 */
export function RequireRole({ role, fallback, children }: RequireRoleProps) {
  const { user, status } = useAuth();
  const { profile, loading } = useUserProfile();
  const { t } = useLocale();
  const navigate = useNavigate();

  const authorized =
    status === "ready" && !!user && !loading && profile.role === role;

  useEffect(() => {
    if (status !== "ready") return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (!loading && profile.role !== role) {
      navigate(fallback, { replace: true });
    }
  }, [status, user, loading, profile.role, role, fallback, navigate]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface text-on-surface">
        <p className="text-body-lg">{t("guard.checking")}</p>
      </div>
    );
  }
  if (!authorized) return null;
  return <>{children}</>;
}
