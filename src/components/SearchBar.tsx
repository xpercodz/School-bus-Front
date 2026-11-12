import { ExpandingSearch } from "@/components/arc/expanding-search/expanding-search";
import { useLocale } from "@/lib/i18n/context";

interface SearchBarProps {
  query: string;
  onChange: (query: string) => void;
  /** Layout classes for the field's slot — usually `min-w-0 flex-1` beside a select. */
  className?: string;
}

/**
 * The roster's search: an icon button that unfolds into the field, and folds back
 * to an icon when it is emptied. It fills whatever slot the caller gives it
 * (`min-w-0 flex-1` beside the grade select), and the icon stays on the start
 * edge so the field grows away from it in both directions.
 *
 * The slot is deliberately not a `data-page-reveal` block: the caller wraps the
 * search and the controls beside it in one, so the row enters as a unit.
 */
export function SearchBar({ query, onChange, className }: SearchBarProps) {
  const { t } = useLocale();

  return (
    <div className={className}>
      <ExpandingSearch
        anchor="start"
        label={t("mobile.searchAria")}
        placeholder={t("mobile.searchPlaceholder")}
        clearLabel={t("mobile.clearSearchAria")}
        value={query}
        onValueChange={onChange}
      />
    </div>
  );
}
