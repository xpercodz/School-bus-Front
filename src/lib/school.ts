import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useUserProfile } from "@/lib/user-profile";
import { queueAudit } from "@/lib/audit";

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

/**
 * How this school names an assignment.
 *
 * - "bus" — a student is assigned to a bus ("Bus 04");
 * - "driver" — the same assignment, labelled by who drives it ("Dana Ortiz").
 *
 * It is ONE value on the school document (`assignmentMode`) rather than a
 * per-device preference, because the choice belongs to the school: two
 * colleagues on the same roll must be reading the same column.
 *
 * An absent field means "bus", which is how every school behaved before this
 * setting existed — no migration.
 */
export type AssignmentMode = "bus" | "driver";

export interface AssignmentModeState {
  mode: AssignmentMode;
  /** True until the school document has answered for this user. */
  loading: boolean;
  /**
   * Write the choice. Optimistic, because a segmented control that waits for a
   * round trip feels broken; the snapshot confirms it a moment later, and a
   * failed write puts the previous value back.
   */
  setMode: (mode: AssignmentMode) => Promise<void>;
}

export function useAssignmentMode(): AssignmentModeState {
  const { profile } = useUserProfile();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const schoolId = profile.schoolId;
  const [mode, setModeState] = useState<AssignmentMode>("bus");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // What to restore if the write is refused (no Assignments grant, offline
  // failure): the value the reader was looking at before they flipped it.
  const lastName = useRef<AssignmentMode>("bus");

  useEffect(() => {
    if (!schoolId || !db) return;
    const firestore = db;
    const unsubscribe = onSnapshot(
      doc(firestore, "schools", schoolId),
      (snap) => {
        const stored = snap.data()?.assignmentMode;
        const next: AssignmentMode = stored === "driver" ? "driver" : "bus";
        lastName.current = next;
        setModeState(next);
        setLoadedFor(schoolId);
      },
      () => setLoadedFor(schoolId),
    );
    return unsubscribe;
  }, [schoolId]);

  const setMode = useCallback(
    async (next: AssignmentMode) => {
      if (!schoolId || !db) return;
      const previous = lastName.current;
      if (next === previous) return;
      lastName.current = next;
      setModeState(next);
      const firestore = db;
      try {
        // The rules let a director, or an operator granted Assignments, change
        // THIS field and nothing else on the school document — plus the
        // mandatory provenance stamp and the entry that records the change.
        const batch = writeBatch(firestore);
        batch.update(doc(firestore, "schools", schoolId), {
          assignmentMode: next,
          updatedBy: uid ?? "",
          updatedAt: serverTimestamp(),
        });
        queueAudit(batch, firestore, schoolId, {
          event: "school.assignment_mode_changed",
          targetType: "school",
          targetId: schoolId,
          changes: { assignmentMode: { from: previous, to: next } },
          occurredAt: new Date(),
        });
        await batch.commit();
      } catch (error) {
        lastName.current = previous;
        setModeState(previous);
        throw error;
      }
    },
    [schoolId, uid],
  );

  return { mode, loading: !!schoolId && loadedFor !== schoolId, setMode };
}
