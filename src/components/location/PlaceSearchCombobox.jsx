import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { searchMarketplacePlaces } from '@/services/locationsService';
import { cn } from '@/lib/utils';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';

const SEARCH_DELAY_MS = 250;

function placeTypeLabel(type) {
  if (type === 'neighbourhood') return 'Neighbourhood';
  if (type === 'suburb') return 'Suburb';
  if (type === 'village') return 'Village';
  if (type === 'town') return 'Town';
  return 'City';
}

export function PlaceSearchCombobox({
  parentId,
  value,
  selectedName = '',
  onSelect,
  disabled = false,
}) {
  const generatedId = useId();
  const inputId = `marketplace-place-${generatedId}`;
  const [searchTerm, setSearchTerm] = useState(selectedName);
  const [debouncedTerm, setDebouncedTerm] = useState(selectedName);

  useEffect(() => {
    setSearchTerm(selectedName);
    setDebouncedTerm(selectedName);
  }, [parentId, selectedName]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTerm(searchTerm), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const placesQuery = useQuery({
    queryKey: ['marketplace-place-search', parentId, debouncedTerm],
    queryFn: () => searchMarketplacePlaces(parentId, debouncedTerm),
    enabled: Boolean(parentId) && !disabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
  const places = placesQuery.data || [];
  const searching = Boolean(parentId) && (placesQuery.isLoading || searchTerm !== debouncedTerm);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const choosePlace = (place) => {
    setSearchTerm(place.name);
    setDebouncedTerm(place.name);
    onSelect(place);
  };

  return (
    <div className="space-y-2 md:col-span-3">
      <Label htmlFor={inputId}>City, town or area</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          id={inputId}
          type="search"
          value={searchTerm}
          onChange={handleSearchChange}
          disabled={!parentId || disabled}
          autoComplete="off"
          placeholder={parentId ? 'Search every registered place…' : 'Choose a province or state first'}
          className="h-11 rounded-lg pl-9"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={Boolean(parentId && !disabled)}
          aria-controls={`${inputId}-results`}
          aria-describedby={`${inputId}-hint`}
        />
        {searching ? <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-primary" aria-label="Searching places" /> : null}
      </div>
      <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
        {searchTerm.trim() ? 'Keep typing to narrow the results.' : 'Popular places appear first. Type any name to search the full registry.'}
      </p>

      {parentId ? (
        <div id={`${inputId}-results`} role="listbox" aria-busy={searching} className="max-h-56 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card" aria-label="Place results">
          {searching ? <div className="p-2"><ListRowsSkeleton rows={3} showThumbnail={false} label="Searching places" /></div> : places.map((place) => {
            const selected = place.id === value;
            return (
              <button
                key={place.id}
                type="button"
                role="option"
                onClick={() => choosePlace(place)}
                aria-selected={selected}
                className={cn(
                  'flex min-h-12 w-full items-center gap-3 border-b border-border/70 px-3 py-2 text-left last:border-b-0 hover:bg-primary/5 focus-visible:bg-primary/5',
                  selected && 'bg-primary/10',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{place.name}</span>
                  <span className="block text-xs text-muted-foreground">{placeTypeLabel(place.type)}{place.population ? ` · ${Number(place.population).toLocaleString()} people` : ''}</span>
                </span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : null}
              </button>
            );
          })}
          {!searching && !placesQuery.isError && places.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No registered place matches that search.</p>
          ) : null}
          {placesQuery.isError ? (
            <div className="flex items-center justify-between gap-3 p-3" role="alert">
              <p className="text-xs text-destructive">Places could not be searched.</p>
              <button type="button" className="text-xs font-semibold text-destructive underline" onClick={() => placesQuery.refetch()}>Retry</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
