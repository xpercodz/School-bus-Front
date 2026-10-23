import { Icon } from "@/components/Icon";
import { useLocale } from "@/lib/i18n/context";

interface SearchBarProps {
  query: string;
  onChange: (query: string) => void;
}

export function SearchBar({ query, onChange }: SearchBarProps) {
  const { t } = useLocale();

  return (
    <div data-page-reveal className="group relative">
      <Icon
        name="search"
        size={18}
        className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary"
      />
      <input
        type="text"
        aria-label={t("mobile.searchAria")}
        placeholder={t("mobile.searchPlaceholder")}
        value={query}
        onChange={(event) => onChange(event.target.value)}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        /* 16px on phones: iOS Safari zooms the page when focusing a field
           smaller than that, which breaks the fixed phone shell. */
        className="h-12 w-full rounded-xl border border-control-outline bg-surface-container-lowest ps-10 pe-12 text-[16px] text-on-surface transition-[border-color,box-shadow] duration-[var(--t-hover)] placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/35"
      />
      {query !== "" && (
        <button
          type="button"
          aria-label={t("mobile.clearSearchAria")}
          onClick={() => onChange("")}
          className="press absolute end-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
        >
          <Icon name="close" size={20} />
        </button>
      )}
    </div>
  );
}
