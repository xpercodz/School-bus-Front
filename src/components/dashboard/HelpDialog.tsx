import { useNavigate } from "react-router-dom";
import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/arc/button/button";
import { Icon } from "@/components/Icon";
import { useTour } from "@/components/dashboard/Tour";
import { useLocale } from "@/lib/i18n/context";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Help for the dashboard top bar, and the door to the two things that answer
 * "how does this work": the walkthrough and the guidebook.
 *
 * ⚠️ THE TOUR MUST BE REACHABLE AFTER IT WAS SKIPPED. The invitation is asked
 * once; without an entry here, a reader who pressed "Not now" could never see it
 * again, which is exactly the complaint this row exists to prevent.
 *
 * `Dialog`'s auto placement makes it a bottom sheet on phones and a centered
 * dialog from sm up; the header stays pinned while long help copy scrolls, and
 * the body steps up to 16px on the narrow screen (the same reason fields do:
 * readability, not zoom).
 */
export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const { t } = useLocale();
  const { start } = useTour();
  const navigate = useNavigate();

  return (
    <Dialog open={open} onClose={onClose} title={t("help.title")}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-outline-variant bg-surface px-4 py-2.5 sm:px-5 sm:py-3">
        <h2 className="min-w-0 truncate text-[18px] font-semibold text-on-surface sm:text-headline-md">
          {t("help.title")}
        </h2>
        <Button
          type="button"
          onClick={onClose}
          aria-label={t("dialog.close")}
          variant="ghost"
          size="md"
          icon
          className="flex-none"
        >
          <Icon name="close" size={22} variant="outlined" />
        </Button>
      </header>
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <p className="whitespace-pre-line text-[16px] leading-7 text-on-surface-variant sm:text-body-md sm:leading-5">
          {t("help.content")}
        </p>
        {/* The two answers to "how does this work": the walkthrough, and the
            manual it summarises. Both live here because Help is where somebody
            looks once they have already decided they need help — and the tour
            must be reopenable after it was skipped. */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-outline-variant pt-4">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="arc-field"
            onClick={() => {
              onClose();
              start();
            }}
          >
            <Icon name="help" size={16} variant="outlined" />
            {t("guide.replayTour")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="arc-field"
            onClick={() => {
              onClose();
              navigate("/dashboard/guide");
            }}
          >
            <Icon name="description" size={16} variant="outlined" />
            {t("help.openGuide")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
