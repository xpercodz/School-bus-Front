import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import type { OperatorScreen } from "@/lib/api-contract";
import { primeSchoolId } from "@/lib/school-id";

/**
 * Roles in the app.
 *
 * - "director" — administers the school. Exactly one of them carries `owner`.
 * - "operator" — office staff below the director. Signs in with email +
 *   password (the same route as the director) and may open only the screens in
 *   `screens`. Every one of these is enforced by `firestore.rules`, not just by
 *   the sidebar hiding a link.
 * - "staff" — the mobile-app user (bus monitor/driver), signing in with a code.
 */
export type UserRole = "director" | "operator" | "staff";

export interface UserProfile {
  role: UserRole | null;
  schoolId: string | null;
  displayName: string | null;
  /**
   * Director-only: the school's MAIN director — the one account that sees the
   * Operators page and may create or re-scope operators. Set by
   * `npm run owner` in the API repo; never from the browser.
   */
  owner: boolean;
  /**
   * Operator-only: the screens they may open. Empty for every other role.
   *
   * Superseded by `permissions` but still read as its fallback: a profile
   * written before capabilities existed holds only this, and dropping it would
   * lock every existing operator out of their own screens.
   */
  screens: OperatorScreen[];
  /**
   * Operator-only: the capabilities they hold (`section.action`, see
   * `lib/permissions.ts`). `null` means "this profile predates the field" —
   * distinct from `[]`, which is an operator who may do nothing at all.
   */
  permissions: string[] | null;
}

/** The profile of a signed-out / not-yet-loaded user. */
export const EMPTY_PROFILE: UserProfile = {
  role: null,
  schoolId: null,
  displayName: null,
  owner: false,
  screens: [],
  permissions: null,
};

/**
 * Realtime read of the signed-in user's `users/{uid}` profile (role, schoolId,
 * owner, operator screens). Powers role-based landing, the sidebar's visible
 * destinations and every route guard. When not configured or signed out,
 * profile.role is null and loading is false.
 */
export function useUserProfile(): { profile: UserProfile; loading: boolean } {
  const { user, status: authStatus } = useAuth();
  const uid = user?.uid;
  const live = isFirebaseConfigured && authStatus === "ready" && !!uid && !!db;

  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const loading = live && loadedUid !== uid;

  useEffect(() => {
    if (!live || !uid || !db) return;
    const firestore = db;
    const unsubscribe = onSnapshot(
      doc(firestore, "users", uid),
      (snap) => {
        const data = snap.data();
        setProfile({
          role: (data?.role as UserRole) ?? null,
          schoolId: (data?.schoolId as string) ?? null,
          displayName: (data?.displayName as string) ?? null,
          owner: data?.owner === true,
          // A malformed list must not grant anything: only strings are kept,
          // and every check tests membership in the known screen set.
          screens: Array.isArray(data?.screens)
            ? (data.screens as unknown[]).filter(
                (screen): screen is OperatorScreen => typeof screen === "string",
              )
            : [],
          // An absent field is `null` (the old profile), an empty list is an
          // operator granted nothing — the two must not collapse into one.
          permissions: Array.isArray(data?.permissions)
            ? (data.permissions as unknown[]).filter(
                (capability): capability is string => typeof capability === "string",
              )
            : null,
        });
        // The profile is the source of the tenant id; share it so no other
        // hook pays a second read of this same document.
        primeSchoolId(uid, (data?.schoolId as string) ?? null);
        setLoadedUid(uid);
      },
      () => setLoadedUid(uid),
    );
    return unsubscribe;
  }, [live, uid]);

  return { profile, loading };
}
