import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserProfile } from "@/lib/user-profile";

/**
 * Realtime name of the signed-in user's school — lets each tenant see their
 * own school in the dashboard. Returns null until signed in / loaded.
 */
export function useSchoolName(): string | null {
  const { profile } = useUserProfile();
  const schoolId = profile.schoolId;
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId || !db) return;
    const firestore = db;
    const unsubscribe = onSnapshot(
      doc(firestore, "schools", schoolId),
      (snap) => {
        setName((snap.data()?.name as string) ?? null);
      },
      // Ignore: sign-out denies every open listener before React unmounts them.
      () => {},
    );
    return unsubscribe;
  }, [schoolId]);

  return name;
}
