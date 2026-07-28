import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function TourCatalogueHeader({ query, location, onQueryChange, onLocationChange }) {
  return (
    <header className="glass-bar sticky top-0 z-40 border-b border-border">
      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">FindIt Tours</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Inspect before you enquire</h1>
          </div>
          <SlidersHorizontal className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_0.7fr]">
          <label htmlFor="tour-catalogue-search" className="relative block">
            <span className="sr-only">Search Tours</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="tour-catalogue-search"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search listings, sellers or locations"
              className="h-11 pl-10 pr-10"
              maxLength={100}
            />
            {query && (
              <button type="button" aria-label="Clear Tour search" onClick={() => onQueryChange('')} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <label htmlFor="tour-catalogue-location">
            <span className="sr-only">Filter Tours by location</span>
            <Input
              id="tour-catalogue-location"
              value={location}
              onChange={(event) => onLocationChange(event.target.value)}
              placeholder="Location"
              className="h-11"
              maxLength={120}
            />
          </label>
        </div>
      </div>
    </header>
  );
}
