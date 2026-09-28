import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

export interface AuthState {
  user: User | null;
  /** "loading" while we wait for Firebase to report the session. */
  status: "loading" | "ready";
}

const AuthContext = createContext<AuthState>({ user: null, status: "loading" });

/**
 * Tracks the Firebase Auth session and exposes it via useAuth().
 *
 * When Firebase isn't configured (env vars empty) the provider is immediately
 * "ready" with a null user, so the app keeps running on mock data.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">(
    isFirebaseConfigured ? "loading" : "ready",
  );

  useEffect(() => {
    // When unconfigured the initial status is already "ready" (see useState).
    if (!isFirebaseConfigured || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      setUser(current);
      setStatus("ready");
    });
    return unsubscribe;
  }, []);

  const value = useMemo(() => ({ user, status }), [user, status]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
