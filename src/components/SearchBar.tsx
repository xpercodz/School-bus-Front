import { ExpandingSearch } from "@/components/arc/expanding-search/expanding-search";
import { useLocale } from "@/lib/i18n/context";

interface SearchBarProps {
  query: string;
  onChange: (query: string) => void;
}

/**
 * The roster's search: an icon button that unfolds into the field, and folds back
 * to an icon when it is emptied. `data-page-reveal` keeps it in the page's
 * entrance sequence.
 */
export function SearchBar({ query, onChange }: SearchBarProps) {
  const { t } = useLocale();

  return (
    <div data-page-reveal>
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
