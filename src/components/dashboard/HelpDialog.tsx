import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/arc/button/button";
import { Icon } from "@/components/Icon";
import { useLocale } from "@/lib/i18n/context";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Static help dialog for the dashboard top bar. `Dialog`'s auto placement
 * makes it a bottom sheet on phones and a centered dialog from sm up; the
 * header stays pinned while long help copy scrolls, and the body steps up to
 * 16px on the narrow screen (the same reason fields do: readability, not zoom).
 */
export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const { t } = useLocale();

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
      <p className="whitespace-pre-line px-4 py-4 text-[16px] leading-7 text-on-surface-variant sm:px-5 sm:py-5 sm:text-body-md sm:leading-5">
        {t("help.content")}
      </p>
    </Dialog>
  );
}
