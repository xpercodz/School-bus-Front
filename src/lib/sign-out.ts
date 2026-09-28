import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/lib/i18n/context";

/**
 * Shared sign-out action: clears the Firebase session, redirects to /login, and
 * toasts. No-op-safe when Firebase isn't configured — the redirect still happens
 * so the caller can leave a protected route.
 */
export function useSignOut() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useLocale();

  return async function handleSignOut(): Promise<void> {
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth);
      } catch {
        // Session already gone — redirect regardless.
      }
    }
    showToast(t("toast.signedOut"));
    navigate("/login");
  };
}
