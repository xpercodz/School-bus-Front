import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

/** Roles in the app. "staff" is the mobile-app user (bus monitor/driver). */
export type UserRole = "director" | "staff";

export interface UserProfile {
  role: UserRole | null;
  schoolId: string | null;
  displayName: string | null;
}

/**
 * Realtime read of the signed-in user's `users/{uid}` profile (role, schoolId).
 * Powers role-based landing and route guards. When not configured or signed
 * out, profile.role is null and loading is false.
 */
export function useUserProfile(): { profile: UserProfile; loading: boolean } {
  const { user, status: authStatus } = useAuth();
  const uid = user?.uid;
  const live = isFirebaseConfigured && authStatus === "ready" && !!uid && !!db;

  const [profile, setProfile] = useState<UserProfile>({
    role: null,
    schoolId: null,
    displayName: null,
  });
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
        });
        setLoadedUid(uid);
      },
      () => setLoadedUid(uid),
    );
    return unsubscribe;
  }, [live, uid]);

  return { profile, loading };
}
