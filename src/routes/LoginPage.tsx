import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { ApiError, directorSignIn, verifyDriverCode } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useUserProfile } from "@/lib/user-profile";
import { useLocale } from "@/lib/i18n/context";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/arc/button/button";
import { ProductMark } from "@/components/ProductMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { OtpInput } from "@/components/arc/otp-input/otp-input";
import { ThemeSwitchButton } from "@/components/ThemeSwitchButton";
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

/**
 * The verified seal, drawn with our own glyph rather than a `verified` icon: the
 * self-hosted Material Symbols subset has no such glyph and a missing one
 * renders its literal name. It arrives with `pop-in`, and the `aria-live` row it
 * sits in is what tells a screen-reader user the code was accepted.
 */
function VerifiedSeal({ label }: { label: string }) {
  return (
    <span className="pop-in inline-flex items-center gap-2 rounded-full bg-success/10 py-1 pe-3 ps-1">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-surface-container-lowest">
        <Icon name="check" size={16} />
      </span>
      <span className="text-[12.5px] font-medium text-success">{label}</span>
    </span>
  );
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
  // The API has accepted the code and Firebase is signing in. The page redirects
  // from the auth effect below, so this state exists only to show the seal.
  const [codeVerified, setCodeVerified] = useState(false);
  const [lockout, setLockout] = useState<Lockout>(readLockout);
  // Rendered "now" for lockout expiry — ticking so the locked message clears and
  // the button re-enables without a render-time Date.now() (purity rule).
  const [now, setNow] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in → land on the right area for the role.
  //
  // A driver who just entered their code is held here for ~0.6s so the verified
  // seal is actually seen: the custom token resolves in the same tick as the
  // success state, so without the hold the badge flashes for one frame. The
  // timer is armed ONCE (ref-guarded) rather than re-armed on every dependency
  // change — `profileLoading` can flip while the profile snapshot lands, and a
  // timer that restarts on each flip can be cleared forever, leaving the driver
  // stuck on "Signing you in…". That is exactly the bug this guards against.
  const redirectTimer = useRef<number | null>(null);
  useEffect(() => {
    if (status !== "ready" || !user || profileLoading) return;
    const target = profile.role === "director" ? "/dashboard" : "/";
    if (!codeVerified) {
      navigate(target, { replace: true });
      return;
    }
    if (redirectTimer.current !== null) return;
    redirectTimer.current = window.setTimeout(() => {
      redirectTimer.current = null;
      navigate(target, { replace: true });
    }, 600);
  }, [status, user, profileLoading, profile.role, navigate, codeVerified]);

  // Tick the lockout clock so an active block is reflected without Date.now()
  // in render (30s granularity is plenty for a 15-minute block).
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  /**
   * Verify one code. Called automatically the moment the sixth digit lands —
   * there is no submit button — and again for a retry, so it takes the value
   * rather than reading state.
   *
   * A failure clears the field: the auto-submit effect fires on "six digits are
   * present", and leaving a rejected code in place would re-submit it forever.
   */
  const submitCode = useCallback(
    async (value: string) => {
      if (!auth || codeSubmitting || codeVerified) return;
      if (lockout.until > Date.now()) return;
      if (!/^\d{6}$/.test(value)) {
        setCodeError(t("login.codeError"));
        return;
      }
      setCodeSubmitting(true);
      setCodeError(null);
      try {
        const token = await verifyDriverCode(value);
        await signInWithCustomToken(auth, token);
        window.localStorage.removeItem(LOCKOUT_KEY);
        setLockout({ fails: 0, until: 0 });
        setCodeVerified(true);
        // The role-based redirect above lands the user on / or /dashboard.
      } catch (err) {
        const next: Lockout =
          lockout.fails + 1 >= MAX_FAILS
            ? { fails: 0, until: Date.now() + LOCKOUT_MS }
            : { fails: lockout.fails + 1, until: lockout.until };
        window.localStorage.setItem(LOCKOUT_KEY, JSON.stringify(next));
        setLockout(next);
        setCodeError(
          err instanceof ApiError && (err.code === "too_many_attempts" || err.code === "rate_limited")
            ? t("login.tooManyAttempts")
            : err instanceof ApiError && err.code === "network_error"
              ? t("login.networkError")
              : err instanceof ApiError && err.status >= 500
                ? t("login.serverError")
                : t("login.codeError"),
        );
        setCode("");
      } finally {
        setCodeSubmitting(false);
      }
    },
    [codeSubmitting, codeVerified, lockout.fails, lockout.until, t],
  );

  // Auto-submit. Six digits is the whole interaction: no button to press.
  useEffect(() => {
    if (mode !== "driver" || code.length !== 6) return;
    if (codeSubmitting || codeVerified) return;
    void submitCode(code);
  }, [code, mode, codeSubmitting, codeVerified, submitCode]);

  /**
   * Director sign-in goes through the API: the server checks the email/password
   * against Firebase Auth AND requires the account's `users/{uid}` profile to be
   * a director before returning a custom token. A driver account typed into the
   * Director tab is rejected with a clear error instead of silently landing on
   * the driver app.
   */
  /** The 15-minute block is active right now. */
  const codeLocked = now > 0 && lockout.until > now;

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
      <div className="flex min-h-dvh flex-col bg-surface px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <div className="flex justify-end gap-1">
          <ThemeSwitchButton iconOnly />
          <LanguageToggle />
        </div>
        <div className="page-enter m-auto w-full max-w-[400px] rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-center sm:p-8">
          <Icon name="cloud_off" size={40} className="mx-auto text-on-surface-variant" />
          <h1 className="mt-4 text-headline-md">{t("login.notConfiguredTitle")}</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {t("login.notConfiguredBody", { code: ".env.local" })}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-on-surface px-5 text-[14px] font-medium text-surface"
          >
            {t("login.backToApp")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <div className="flex justify-end gap-1">
        <ThemeSwitchButton iconOnly />
        <LanguageToggle />
      </div>
      <div className="page-enter m-auto w-full max-w-[400px] rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <ProductMark size={32} />
          <h1 className="text-headline-md">{t("login.heading")}</h1>
        </div>
        <p className="mt-2 text-[13.5px] leading-5 text-on-surface-variant">
          {t("login.subtitle")}
        </p>

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
          <div className="mt-6 flex flex-col gap-4">
            {/* Six boxes, one ring gliding between them, and no submit button:
                the sixth digit is the submission. The library renders the field
                label, the hint and the error, so they are passed as props and
                translated here. */}
            <div className={codeLocked ? "pointer-events-none opacity-60" : undefined}>
              <OtpInput
                label={t("login.code")}
                description={t("login.driverHint")}
                error={codeLocked ? undefined : (codeError ?? undefined)}
                value={code}
                onChange={setCode}
                sanitize={normalizeDigits}
                digitLabel={(index, total) =>
                  t("login.codeDigitAria", { label: t("login.code"), index: index + 1, total })
                }
                disabled={codeSubmitting || codeVerified}
                inputMode="numeric"
                autoFocus
              />
            </div>

            {codeLocked ? (
              <p role="alert" className="text-body-md text-error">
                {t("login.codeLocked", {
                  minutes: String(Math.max(1, Math.ceil((lockout.until - now) / 60000))),
                })}
              </p>
            ) : (
              <div className="flex min-h-8 items-center gap-2 text-[12.5px] text-on-surface-variant" aria-live="polite">
                {codeVerified ? (
                  <>
                    <VerifiedSeal label={t("login.codeVerified")} />
                    <span>{t("login.codeVerifiedHint")}</span>
                  </>
                ) : codeSubmitting ? (
                  <>
                    <Icon name="progress_activity" size={16} className="animate-spin" />
                    {t("login.codeChecking")}
                  </>
                ) : (
                  <span>
                    {t("login.codeDigitAria", {
                      label: t("login.code"),
                      index: Math.min(code.length + 1, 6),
                      total: 6,
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleDirectorSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="text-[13px] font-medium text-on-surface">
                {t("login.email")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-lg border border-control-outline bg-surface-container-lowest px-3 text-[16px] text-on-surface outline-none transition-[border-color,box-shadow] duration-[var(--t-hover)] placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/35 sm:text-[15px]"
                placeholder={t("login.emailPlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="password" className="text-[13px] font-medium text-on-surface">
                {t("login.password")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-lg border border-control-outline bg-surface-container-lowest ps-3 pe-12 text-[16px] text-on-surface outline-none transition-[border-color,box-shadow] duration-[var(--t-hover)] placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/35 sm:text-[15px]"
                  placeholder={t("login.passwordPlaceholder")}
                />
                {/* The wrapper owns the overlay placement: the Button module sets position: relative. */}
                <div className="absolute end-1 top-1/2 -translate-y-1/2">
                  <Button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={t(showPassword ? "login.hidePassword" : "login.showPassword")}
                    aria-pressed={showPassword}
                    variant="ghost"
                    size="md"
                    icon
                  >
                    <span key={showPassword ? "hide" : "show"} className="icon-pop flex items-center">
                      <Icon name={showPassword ? "visibility_off" : "visibility"} size={20} />
                    </span>
                  </Button>
                </div>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-body-md text-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              loading={submitting}
              variant="primary"
              size="md"
            >
              <Icon name="login" />
              {t("login.signIn")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
