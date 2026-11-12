import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { useAuth } from "@/lib/auth";
import { useUserProfile, type UserProfile } from "@/lib/user-profile";
import {
  canOpenScreen,
  firstAllowedHref,
  isManagement,
  type ScreenId,
} from "@/lib/permissions";
import { MainDirectorProvider, useMainDirector } from "@/lib/main-director";
import { useLocale } from "@/lib/i18n/context";

interface GateState {
  /** Signed in, profile loaded — the point at which a decision is honest. */
  settled: boolean;
  user: User | null;
  profile: UserProfile;
  loading: boolean;
}

/** The auth + profile read both guards need, so neither owns its own copy. */
function useGate(): GateState {
  const { user, status } = useAuth();
  const { profile, loading } = useUserProfile();
  return {
    settled: status === "ready" && !loading,
    user,
    profile,
    loading,
  };
}

/** The few hundred ms before a profile is known — never a blank flash. */
function Checking() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface text-on-surface">
      <p className="text-body-lg">{t("guard.checking")}</p>
    </div>
  );
}

/**
 * The dashboard shell's gate: signed-in management only.
 *
 * "Management" is a director or an operator. A driver (`staff`) arriving here is
 * sent back to the phone roster, signed-out users to /login. What an operator may
 * open *inside* the shell is `RequireScreen`'s job, one route at a time.
 */
export function RequireAccess({ children }: { children: ReactNode }) {
  const { settled, user, profile, loading } = useGate();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isManagement(profile)) navigate("/", { replace: true });
  }, [user, loading, profile, navigate]);

  // Settled and refused: the redirect above is in flight, so render nothing
  // rather than a second "checking" frame.
  if (!settled) return <Checking />;
  if (!user || !isManagement(profile)) return null;
  // The flag is resolved once here — the rail, the phone bar and every route
  // guard read the same answer, so they cannot disagree.
  return <MainDirectorProvider>{children}</MainDirectorProvider>;
}

/**
 * One dashboard route's gate: a director, or an operator holding that screen.
 *
 * A denied reader is sent to the first destination they CAN use, not back to a
 * fixed page — an operator granted only Reports must not be dropped on the Live
 * monitor, which would immediately bounce them again.
 */
export function RequireScreen({
  screen,
  children,
}: {
  screen: ScreenId;
  children: ReactNode;
}) {
  const { settled, user, profile } = useGate();
  const navigate = useNavigate();
  const mainDirector = useMainDirector();
  const allowed = canOpenScreen(profile, screen, mainDirector);

  useEffect(() => {
    if (!settled) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (!allowed) navigate(firstAllowedHref(profile, mainDirector), { replace: true });
  }, [settled, user, allowed, profile, mainDirector, navigate]);

  if (!settled) return <Checking />;
  if (!user || !allowed) return null;
  return <>{children}</>;
}
