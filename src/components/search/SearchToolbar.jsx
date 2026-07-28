import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, MapPin, Search, SlidersHorizontal, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const SUGGESTIONS_ID = 'listing-search-suggestions';

function SuggestionButton({ id, icon: Icon, label, meta, onSelect, active, onMouseEnter }) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={onMouseEnter}
      onClick={onSelect}
      className={cn(
        'flex min-h-11 w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-surface-raised',
        active && 'bg-surface-raised',
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{meta}</span>
    </button>
  );
}

export default function SearchToolbar({
  queryInput,
  onQueryInputChange,
  onSubmit,
  focused,
  onFocusChange,
  categorySuggestions,
  suggestions,
  hasSuggestions,
  onSelectCategory,
  onSelectLocation,
  onSelectListing,
  onOpenFilters,
  onOpenSort,
  hasFilters,
  sortLabel,
}) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const entries = useMemo(() => [
    ...categorySuggestions.map((item) => ({ key: `category-${item.value}`, icon: Tag, label: item.label, meta: 'Category', select: () => onSelectCategory(item) })),
    ...(suggestions?.locations || []).map((item) => ({ key: `location-${item.id}`, icon: MapPin, label: item.name, meta: item.type, select: () => onSelectLocation(item) })),
    ...(suggestions?.listings || []).map((item) => ({ key: `listing-${item.id}`, icon: Search, label: item.title, meta: 'Listing', select: () => onSelectListing(item) })),
  ], [categorySuggestions, suggestions, onSelectCategory, onSelectLocation, onSelectListing]);
  const showSuggestions = focused && hasSuggestions && entries.length > 0;

  useEffect(() => {
    setActiveIndex(-1);
  }, [queryInput, showSuggestions]);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      onFocusChange(false);
      setActiveIndex(-1);
      return;
    }
    if (!showSuggestions) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % entries.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? entries.length - 1 : current - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      entries[activeIndex].select();
      onFocusChange(false);
    }
  };

  return (
    <div className="mt-4 flex items-start gap-2">
      <form
        onSubmit={onSubmit}
        className="relative min-w-0 flex-1"
        role="search"
        onFocus={() => onFocusChange(true)}
        onBlur={() => window.setTimeout(() => onFocusChange(false), 120)}
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="listing-search"
          type="search"
          role="combobox"
          aria-label="Search listings"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? SUGGESTIONS_ID : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${SUGGESTIONS_ID}-${activeIndex}` : undefined}
          placeholder="Search in this category"
          value={queryInput}
          onChange={(event) => onQueryInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          maxLength={100}
          className="h-12 rounded-2xl bg-card pl-10"
        />
        {showSuggestions && (
          <div id={SUGGESTIONS_ID} role="listbox" aria-label="Search suggestions" className="absolute left-0 right-0 top-14 z-50 overflow-hidden rounded-2xl border border-border-strong bg-card shadow-floating">
            {entries.map((entry, index) => (
              <SuggestionButton
                key={entry.key}
                id={`${SUGGESTIONS_ID}-${index}`}
                icon={entry.icon}
                label={entry.label}
                meta={entry.meta}
                active={activeIndex === index}
                onMouseEnter={() => setActiveIndex(index)}
                onSelect={() => {
                  entry.select();
                  onFocusChange(false);
                }}
              />
            ))}
          </div>
        )}
      </form>

      <button
        type="button"
        onClick={onOpenFilters}
        aria-label="Open filters"
        className={cn(
          'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-card text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground',
          hasFilters ? 'border-primary/45 text-primary' : 'border-border',
        )}
      >
        <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
        {hasFilters && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
      </button>

      <button
        type="button"
        onClick={onOpenSort}
        aria-label={`Sort listings, currently ${sortLabel}`}
        className="flex h-12 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-border bg-card px-3 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
      >
        <ArrowUpDown className="h-5 w-5" aria-hidden="true" />
        <span className="hidden text-xs font-semibold lg:inline">{sortLabel}</span>
      </button>
    </div>
  );
}
