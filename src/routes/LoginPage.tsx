import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { ApiError, directorSignIn, verifyDriverCode } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useUserProfile } from "@/lib/user-profile";
import { useLocale } from "@/lib/i18n/context";
import { Icon } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SlideSegments } from "@/components/SlideSegments";

/** Driver access-code lockout: 5 wrong codes → 15-minute block (localStorage). */
const LOCKOUT_KEY = "sb:codeLockout";
const MAX_FAILS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface Lockout {
  fails: number;
  until: number;
}

function readLockout(): Lockout {
  if (typeof window === "undefined") return { fails: 0, until: 0 };
  try {
    const raw = window.localStorage.getItem(LOCKOUT_KEY);
    if (!raw) return { fails: 0, until: 0 };
    const parsed = JSON.parse(raw) as { fails?: number; until?: number };
    return { fails: parsed.fails ?? 0, until: parsed.until ?? 0 };
  } catch {
    return { fails: 0, until: 0 };
  }
}

/** Map Arabic-Indic (٠-٩) and Persian (۰-۹) digits to ASCII for the code field. */
function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

type Mode = "driver" | "director";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { t } = useLocale();
  const [mode, setMode] = useState<Mode>("driver");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [lockout, setLockout] = useState<Lockout>(readLockout);
  // Rendered "now" for lockout expiry — ticking so the locked message clears and
  // the button re-enables without a render-time Date.now() (purity rule).
  const [now, setNow] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in → land on the right area for the role.
  useEffect(() => {
    if (status === "ready" && user && !profileLoading) {
      navigate(profile.role === "director" ? "/dashboard" : "/", { replace: true });
    }
  }, [status, user, profileLoading, profile.role, navigate]);

  // Tick the lockout clock so an active block is reflected without Date.now()
  // in render (30s granularity is plenty for a 15-minute block).
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function handleCodeSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth || codeSubmitting || lockout.until > Date.now()) return;
    if (!/^\d{6}$/.test(code)) {
      setCodeError(t("login.codeError"));
      return;
    }
    setCodeSubmitting(true);
    setCodeError(null);
    try {
      const token = await verifyDriverCode(code);
      await signInWithCustomToken(auth, token);
      window.localStorage.removeItem(LOCKOUT_KEY);
      setLockout({ fails: 0, until: 0 });
      // The role-based redirect above lands the user on / or /dashboard.
    } catch {
      const next: Lockout = lockout.fails + 1 >= MAX_FAILS
        ? { fails: 0, until: Date.now() + LOCKOUT_MS }
        : { fails: lockout.fails + 1, until: lockout.until };
      window.localStorage.setItem(LOCKOUT_KEY, JSON.stringify(next));
      setLockout(next);
      setCodeError(t("login.codeError"));
    } finally {
      setCodeSubmitting(false);
    }
  }

  /**
   * Director sign-in goes through the API: the server checks the email/password
   * against Firebase Auth AND requires the account's `users/{uid}` profile to be
   * a director before returning a custom token. A driver account typed into the
   * Director tab is rejected with a clear error instead of silently landing on
   * the driver app.
   */
  async function handleDirectorSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await directorSignIn(email.trim(), password);
      await signInWithCustomToken(auth, token);
      // The role-based redirect effect above lands the user on /dashboard.
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(t("login.notDirector"));
      } else if (err instanceof ApiError && err.status === 429) {
        setError(t("login.tooManyAttempts"));
      } else {
        // 401 (wrong email/password) and anything else → generic message.
        setError(t("login.fallbackError"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="relative flex min-h-dvh bg-surface px-4">
        <div className="absolute end-4 top-4">
          <LanguageToggle />
        </div>
        <div className="m-auto w-full max-w-sm rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
          <Icon name="cloud_off" size={40} className="mx-auto text-on-surface-variant" />
          <h1 className="mt-4 text-headline-md">{t("login.notConfiguredTitle")}</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {t("login.notConfiguredBody", { code: ".env.local" })}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-label-lg text-on-primary"
          >
            {t("login.backToApp")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh bg-surface px-4">
      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>
      <div className="m-auto w-full max-w-sm rounded-2xl border border-outline-variant bg-surface-container-lowest p-8">
        <div className="flex items-center gap-2">
          <Icon name="directions_bus" className="text-primary" />
          <h1 className="text-headline-md">{t("login.heading")}</h1>
        </div>
        <p className="mt-1 text-body-md text-on-surface-variant">{t("login.subtitle")}</p>

        <div className="mt-6">
          <SlideSegments
            variant="pill"
            ariaLabel={t("login.modeAria")}
            options={[
              { id: "driver" as const, label: t("login.driverTab") },
              { id: "director" as const, label: t("login.directorTab") },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>

        {mode === "driver" ? (
          <form onSubmit={handleCodeSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="code" className="text-label-lg text-on-surface">
                {t("login.code")}
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(normalizeDigits(e.target.value).replace(/\D/g, ""))}
                className="mt-1 h-14 w-full rounded-full bg-surface-container-high px-4 text-center text-headline-md tracking-[0.5em] text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:bg-surface-container-highest focus:ring-2 focus:ring-primary"
                placeholder={t("login.codePlaceholder")}
                aria-describedby="code-hint"
              />
            </div>

            <p id="code-hint" className="text-body-md text-on-surface-variant">
              {t("login.driverHint")}
            </p>

            {now > 0 && lockout.until > now ? (
              <p role="alert" className="text-body-md text-error">
                {t("login.codeLocked", {
                  minutes: String(Math.max(1, Math.ceil((lockout.until - now) / 60000))),
                })}
              </p>
            ) : (
              codeError && (
                <p role="alert" className="text-body-md text-error">
                  {codeError}
                </p>
              )
            )}

            <button
              type="submit"
              disabled={codeSubmitting || (now > 0 && lockout.until > now)}
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-primary text-label-lg text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {codeSubmitting ? (
                <Icon name="progress_activity" className="animate-spin" />
              ) : (
                <Icon name="login" />
              )}
              {t("login.signIn")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleDirectorSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="text-label-lg text-on-surface">
                {t("login.email")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-14 w-full rounded-full bg-surface-container-high px-4 text-body-lg text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:bg-surface-container-highest focus:ring-2 focus:ring-primary"
                placeholder={t("login.emailPlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="password" className="text-label-lg text-on-surface">
                {t("login.password")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-14 w-full rounded-full bg-surface-container-high px-4 text-body-lg text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:bg-surface-container-highest focus:ring-2 focus:ring-primary"
                placeholder={t("login.passwordPlaceholder")}
              />
            </div>

            {error && (
              <p role="alert" className="text-body-md text-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-primary text-label-lg text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? (
                <Icon name="progress_activity" className="animate-spin" />
              ) : (
                <Icon name="login" />
              )}
              {t("login.signIn")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
