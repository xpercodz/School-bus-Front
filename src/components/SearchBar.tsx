import { Icon } from "@/components/Icon";
import { useLocale } from "@/lib/i18n/context";

interface SearchBarProps {
  query: string;
  onChange: (query: string) => void;
}

export function SearchBar({ query, onChange }: SearchBarProps) {
  const { t } = useLocale();

  return (
    <div className="relative">
      <Icon
        name="search"
        size={18}
        className="absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
      />
      <input
        type="text"
        aria-label={t("mobile.searchAria")}
        placeholder={t("mobile.searchPlaceholder")}
        value={query}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-outline-variant bg-surface-container-lowest ps-10 pe-12 text-[15px] text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {query !== "" && (
        <button
          type="button"
          aria-label={t("mobile.clearSearchAria")}
          onClick={() => onChange("")}
          className="absolute end-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container"
        >
          <Icon name="close" size={20} />
        </button>
      )}
    </div>
  );
}
