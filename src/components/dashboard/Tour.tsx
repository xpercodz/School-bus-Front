/**
 * THE DASHBOARD TOUR — one control at a time, with its own edge lit.
 *
 * ── WHAT IT LOOKS LIKE ──────────────────────────────────────────────────────
 * No dimming, no arrow, no glow and no pulsing ring: the CONTROL'S OWN EDGE gets
 * a 2px stroke in the product's accent, and a small card sits beside it. The
 * card and the stroke take no pointer events, so the page underneath stays
 * usable — which is the point of a non-modal tour.
 *
 * ── WHY IT IS NOT A MODAL ───────────────────────────────────────────────────
 * Not every reader wants to be led; the tour is an offer, not a gate. `role`
 * stays `dialog` with `aria-modal="false"`: focus moves to the card so the step
 * is announced, but Tab and the pointer still reach the dashboard.
 *
 * ── MEASURING ───────────────────────────────────────────────────────────────
 * The ring is `position: fixed`, measured from `getBoundingClientRect()`, and it
 * re-measures on scroll and resize, so it tracks the control while a smooth
 * scroll brings it into view. The card's top is clamped once its real height is
 * known, because Arabic copy is taller than the English it was measured against.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/arc/button/button";
import { useAuth } from "@/lib/auth";
import { canOpenScreen } from "@/lib/permissions";
import { useMainDirector } from "@/lib/main-director";
import { useUserProfile, type UserProfile } from "@/lib/user-profile";
import { useLocale } from "@/lib/i18n/context";
import { prefersReducedMotion } from "@/lib/theme";
import { markTourSeen, tourSeen } from "@/lib/tour-seen";
import { tourSteps, type TourStep } from "@/lib/tour";
import { TourInvite } from "@/components/dashboard/TourInvite";

const CARD_MAX_W = 360;
const GAP = 14;
const EDGE = 12;

interface Ring {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

interface Geo {
  /** The lit control, or null for a centred step. */
  ring: Ring | null;
  left: number;
  width: number;
  /** Where the card wants to sit — clamped once its height is known. */
  top: number;
  centred: boolean;
}

function prefersReduced(): boolean {
  return prefersReducedMotion();
}

function ringOf(element: Element): Ring {
  const rect = element.getBoundingClientRect();
  const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
  return {
    top: rect.top - 3,
    left: rect.left - 3,
    width: rect.width + 6,
    height: rect.height + 6,
    radius: Number.isFinite(radius) ? radius + 3 : 11,
  };
}

function layout(ring: Ring | null, vw: number, vh: number): Geo {
  const width = Math.min(CARD_MAX_W, vw - EDGE * 2);
  if (ring === null) {
    return { ring: null, left: (vw - width) / 2, width, top: vh * 0.4, centred: true };
  }
  const below = ring.top + ring.height + GAP;
  const above = ring.top - GAP;
  // Prefer below; fall back above when the control sits near the bottom.
  const top = vh - below >= 210 ? below : Math.max(EDGE, above - 210);
  const left = Math.min(Math.max(EDGE, ring.left), vw - width - EDGE);
  return { ring, left, width, top, centred: false };
}

export function Tour({
  onClose,
  onNavigate,
  profile,
  mainDirector,
}: {
  onClose: () => void;
  /** Route the shell to a step's page; the card is placed once it arrives. */
  onNavigate: (path: string) => void;
  /**
   * ⚠️ THE PROFILE IS PASSED IN, NOT READ HERE. `useUserProfile()` starts every
   * fresh mount at `EMPTY_PROFILE` and fills in on the next snapshot, so reading
   * it in this component meant the step list was computed from a role of `null`
   * — which drops every `screen`-gated step and left the tour two cards long
   * (nav, then the close). The host has been mounted since the shell settled and
   * holds the loaded profile; pass that.
   */
  profile: UserProfile;
  mainDirector: boolean;
}) {
  const { t, dir } = useLocale();
  const { pathname } = useLocation();
  const reduced = useMemo(prefersReduced, []);

  // The list is frozen when the tour opens. It is filtered by CAPABILITY only:
  // steps live on other screens, so their controls are not in the DOM yet and
  // filtering by presence here would silently drop every page but this one.
  const [steps] = useState<TourStep[]>(() => tourSteps(profile, mainDirector));

  const [index, setIndex] = useState(0);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [top, setTop] = useState(EDGE);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps?.[index];

  const measure = useCallback(() => {
    const current = steps[index];
    if (current === undefined) return;
    const element =
      current.target === undefined ? null : document.querySelector(current.target);
    setGeo(
      layout(
        element === null ? null : ringOf(element),
        window.innerWidth,
        window.innerHeight,
      ),
    );
  }, [index, steps]);

  /**
   * Show this step: go to its page if it lives on another screen, wait for its
   * control to arrive, scroll it to the middle, then keep the ring on it.
   *
   * ⚠️ THE CONTROL IS NOT THERE ON THE FIRST FRAME OF A NEW PAGE. The route
   * chunk, the page-enter animation and the first Firestore snapshot all land
   * after the navigation, so the selector is polled for a beat. If it never
   * appears (a screen with no data, a rail control behind a closed drawer on a
   * phone), the card is placed centred rather than pointing at nothing.
   */
  const navigatedFor = useRef<string | null>(null);
  useEffect(() => {
    const current = steps[index];
    if (current === undefined) return;

    let cancelled = false;
    let poll = 0;
    let pollTimer = 0;
    let settleTimer = 0;

    const place = () => {
      if (cancelled) return;
      const element =
        current.target === undefined ? null : document.querySelector(current.target);
      if (element === null) {
        // ~1.2s: long enough for the route chunk and the first snapshot,
        // short enough that a screen with no data (its section never renders)
        // centres the card instead of stalling.
        const wait = current.centredFallback !== true && poll < 20;
        if (wait) {
          poll += 1;
          pollTimer = window.setTimeout(place, 60);
          return;
        }
        measure();
        return;
      }
      element.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: reduced ? "auto" : "smooth",
      });
      measure();
      settleTimer = window.setTimeout(measure, reduced ? 0 : 380);
    };

    if (
      current.path !== undefined &&
      pathname !== current.path &&
      navigatedFor.current !== current.id
    ) {
      navigatedFor.current = current.id;
      setGeo(null);
      onNavigate(current.path);
    }
    place();

    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      cancelled = true;
      window.clearTimeout(pollTimer);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [index, measure, onNavigate, pathname, reduced, steps]);

  // Arabic is taller than English, so the wanted top is clamped against the
  // card's real height rather than an estimate.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (geo === null || card === null) return;
    const max = window.innerHeight - card.offsetHeight - EDGE;
    const next = geo.centred
      ? Math.max(EDGE, (window.innerHeight - card.offsetHeight) / 2)
      : Math.min(geo.top, Math.max(EDGE, max));
    setTop(next);
  }, [geo]);

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    if (steps.length === 0) onClose();
  }, [onClose, steps.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (step === undefined || geo === null) return null;

  const total = steps.length;
  const last = index === total - 1;
  function go(delta: number) {
    const target = index + delta;
    if (target < 0) return;
    if (target >= total) {
      onClose();
      return;
    }
    setIndex(target);
  }

  return (
    <>
      {geo.ring !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] border-2 border-dash-primary motion-safe:transition-none"
          style={{
            top: geo.ring.top,
            left: geo.ring.left,
            width: geo.ring.width,
            height: geo.ring.height,
            borderRadius: geo.ring.radius,
          }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        tabIndex={-1}
        data-testid="tour-card"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            go(dir === "rtl" ? -1 : 1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            go(dir === "rtl" ? 1 : -1);
          }
        }}
        className="fixed z-[61] rounded-lg border border-dash-outline-variant bg-dash-surface p-4 shadow-float outline-none"
        style={{ top, left: geo.left, width: geo.width }}
      >
        <div aria-live="polite">
          <p className="text-[11px] font-medium tabular-nums text-dash-on-surface-variant">
            {t("tour.stepOf", {
              current: index + 1,
              total,
            })}
          </p>
          <h2
            id="tour-title"
            className="mt-1 text-[17px] font-semibold leading-6 text-dash-on-surface"
          >
            {t(step.titleKey)}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-6 text-dash-on-surface-variant">
            {t(step.bodyKey)}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t("tour.skip")}
          </Button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="arc-field"
                onClick={() => go(-1)}
              >
                {t("tour.back")}
              </Button>
            )}
            <Button type="button" variant="primary" size="sm" onClick={() => go(1)}>
              {last ? t("tour.finish") : t("tour.next")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* The host                                                                    */
/* -------------------------------------------------------------------------- */

interface TourApi {
  /** Open the tour; from another screen it goes to the Live monitor first. */
  start: () => void;
}

const TourContext = createContext<TourApi | null>(null);

export function useTour(): TourApi {
  const api = useContext(TourContext);
  if (api === null) throw new Error("useTour must be used inside TourHost");
  return api;
}

/**
 * Owns the invitation and the tour, and renders both inside the dashboard shell
 * — which is the only place `useMainDirector` is provided.
 */
export function TourHost({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile();
  const mainDirector = useMainDirector();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const uid = user?.uid ?? "";

  const [invited, setInvited] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const canTourLive = canOpenScreen(profile, "live", mainDirector);

  // Ask once per account, on the monitor where every step has its control, and
  // only after the first paint has settled.
  useEffect(() => {
    if (loading || !canTourLive || pathname !== "/dashboard") return;
    if (tourSeen(uid)) return;
    const timer = window.setTimeout(() => setInvited(true), 1200);
    return () => window.clearTimeout(timer);
  }, [canTourLive, loading, pathname, uid]);

  // An unanswered invitation is not parked for later: leaving the monitor drops
  // it, and the next visit asks again (until either answer is given).
  useEffect(() => {
    if (pathname !== "/dashboard") setInvited(false);
  }, [pathname]);

  // Replaying from the guidebook needs the monitor's controls, so go there and
  // wait a beat for the screen to arrive.
  useEffect(() => {
    if (!pending || pathname !== "/dashboard") return;
    const timer = window.setTimeout(() => {
      setPending(false);
      setOpen(true);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [pathname, pending]);

  const start = useCallback(() => {
    // Opening it is an answer to "want a tour?": the invitation must not come
    // back because the tour was replayed before the first one was answered.
    markTourSeen(uid);
    setInvited(false);
    if (canTourLive && pathname !== "/dashboard") {
      navigate("/dashboard");
      setPending(true);
      return;
    }
    setOpen(true);
  }, [canTourLive, navigate, pathname, uid]);

  const answer = useCallback(
    (run: boolean) => {
      markTourSeen(uid);
      setInvited(false);
      if (run) setOpen(true);
    },
    [uid],
  );

  const close = useCallback(() => {
    markTourSeen(uid);
    setOpen(false);
  }, [uid]);

  // The tour walks the dashboard itself, so its own navigation must not end it.
  // A navigation the reader makes still does: they have decided to explore, and
  // a non-modal card left over a page it was not written for is worse than none.
  const guidedTo = useRef<string | null>(null);
  const tourNavigate = useCallback(
    (path: string) => {
      guidedTo.current = path;
      navigate(path);
    },
    [navigate],
  );

  const openedOn = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      openedOn.current = null;
      guidedTo.current = null;
      return;
    }
    if (openedOn.current === null) {
      openedOn.current = pathname;
      return;
    }
    if (openedOn.current === pathname) return;
    if (guidedTo.current === pathname) {
      guidedTo.current = null;
      openedOn.current = pathname;
      return;
    }
    close();
  }, [close, open, pathname]);

  const api = useMemo<TourApi>(() => ({ start }), [start]);

  return (
    <TourContext.Provider value={api}>
      {children}
      {invited && !open && (
        <TourInvite onAccept={() => answer(true)} onDecline={() => answer(false)} />
      )}
      {/* `!loading` is belt-and-braces: every door into the tour is already
          behind a settled shell, but rendering the tour a beat early would
          compute its steps from an empty profile. */}
      {open && !loading && (
        <Tour
          onClose={close}
          onNavigate={tourNavigate}
          profile={profile}
          mainDirector={mainDirector}
        />
      )}
    </TourContext.Provider>
  );
}
