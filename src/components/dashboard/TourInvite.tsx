/**
 * "Want a quick tour?" — asked once per account per browser.
 *
 * It is an offer, not a gate: a modal would stop somebody who came to dispatch
 * a run, so this is a small card in the top-end corner that leaves the page
 * usable and STEALS NO FOCUS. Escape is the same answer as "Not now".
 */
import { Button } from "@/components/arc/button/button";
import { useLocale } from "@/lib/i18n/context";

export interface TourInviteProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function TourInvite({ onAccept, onDecline }: TourInviteProps) {
  const { t } = useLocale();

  return (
    <section
      role="region"
      aria-labelledby="tour-invite-title"
      aria-live="polite"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onDecline();
        }
      }}
      /* ABOVE THE BOTTOM NAV, NOT UNDER THE HEADER. The top-end corner holds
         the screen's own actions (Export, Dispatch) and the day's first
         figures, so a card parked there covers the two things a reader came
         for. The bottom edge is empty on this screen, and `lg` is where the
         phone nav disappears. */
      className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[65] rounded-lg border border-dash-outline-variant bg-dash-surface p-4 shadow-float lg:inset-x-auto lg:end-6 lg:bottom-6 lg:w-[22rem]"
    >
      <h2
        id="tour-invite-title"
        className="text-[15px] font-semibold leading-5 text-dash-on-surface"
      >
        {t("tour.invite.title")}
      </h2>
      <p className="mt-1 text-[13px] leading-5 text-dash-on-surface-variant">
        {t("tour.invite.body")}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDecline}>
          {t("tour.invite.later")}
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={onAccept}>
          {t("tour.invite.start")}
        </Button>
      </div>
    </section>
  );
}
