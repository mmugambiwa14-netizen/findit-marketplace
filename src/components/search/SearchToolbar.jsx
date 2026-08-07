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
      <span className="clay-icon h-8 w-8 shrink-0 text-primary"><Icon className="h-4 w-4" aria-hidden="true" /></span>
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
  filterCount = 0,
  sortLabel,
}) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const entries = useMemo(() => [
    ...categorySuggestions.map((item) => ({ key: `category-${item.value}`, icon: Tag, label: item.label, meta: 'Category', select: () => onSelectCategory(item) })),
    ...(suggestions?.locations || []).map((item) => ({ key: `location-${item.id}`, icon: MapPin, label: item.name, meta: item.type, select: () => onSelectLocation(item) })),
    ...(suggestions?.listings || []).map((item) => ({ key: `listing-${item.id}`, icon: Search, label: item.title, meta: 'Listing', select: () => onSelectListing(item) })),
  ], [categorySuggestions, suggestions, onSelectCategory, onSelectLocation, onSelectListing]);
  const showSuggestions = focused && hasSuggestions && entries.length > 0;

  useEffect(() => setActiveIndex(-1), [queryInput, showSuggestions]);

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
    <div className="mt-4 space-y-2.5">
      <form
        onSubmit={onSubmit}
        className="relative"
        role="search"
        onFocus={() => onFocusChange(true)}
        onBlur={() => window.setTimeout(() => onFocusChange(false), 120)}
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="listing-search"
          type="search"
          role="combobox"
          aria-label="Search listings"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? SUGGESTIONS_ID : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${SUGGESTIONS_ID}-${activeIndex}` : undefined}
          placeholder="Search listings"
          value={queryInput}
          onChange={(event) => onQueryInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          maxLength={100}
          className="clay-control h-12 rounded-2xl pl-10 pr-4"
        />
        {showSuggestions && (
          <div id={SUGGESTIONS_ID} role="listbox" aria-label="Search suggestions" className="clay-card absolute left-0 right-0 top-14 z-50 overflow-hidden rounded-2xl">
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

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenFilters}
          aria-label={filterCount > 0 ? `Open filters, ${filterCount} active` : 'Open filters'}
          className={cn(
            'clay-control flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:text-foreground',
            hasFilters && 'border-primary/45 bg-primary/10 text-primary',
          )}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Filters</span>
          {filterCount > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-primary-foreground">{filterCount}</span>}
        </button>

        <button
          type="button"
          onClick={onOpenSort}
          aria-label={`Sort listings, currently ${sortLabel}`}
          className="clay-control flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowUpDown className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{sortLabel}</span>
        </button>
      </div>
    </div>
  );
}
