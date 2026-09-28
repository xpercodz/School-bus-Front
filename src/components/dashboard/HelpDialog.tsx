import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { useLocale } from "@/lib/i18n/context";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Static help dialog for the dashboard top bar. */
export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const { t } = useLocale();

  return (
    <Dialog open={open} onClose={onClose} title={t("help.title")}>
      <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
        <h2 className="text-headline-md text-on-surface">{t("help.title")}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("dialog.close")}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <Icon name="close" variant="outlined" />
        </button>
      </div>
      <p className="whitespace-pre-line p-4 text-body-md text-on-surface-variant">
        {t("help.content")}
      </p>
    </Dialog>
  );
}
