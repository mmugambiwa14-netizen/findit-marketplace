import { MapPin, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function TourCatalogueHeader({ query, location, onQueryChange, onLocationChange }) {
  return (
    <header className="glass-bar sticky top-0 z-40 border-b border-border/80">
      <div className="mx-auto max-w-3xl px-4 pb-3 pt-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="findit-overline">FindIt marketplace</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Tours</h1>
          </div>
          <span className="clay-icon h-11 w-11 text-foreground" aria-hidden="true">
            <Search className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_0.72fr]">
          <label htmlFor="tour-catalogue-search" className="relative block">
            <span className="sr-only">Search Tours</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="tour-catalogue-search"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search listings, sellers or locations"
              className="clay-control h-11 rounded-xl pl-10 pr-10"
              maxLength={100}
            />
            {query && (
              <button type="button" aria-label="Clear Tour search" onClick={() => onQueryChange('')} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <label htmlFor="tour-catalogue-location" className="relative block">
            <span className="sr-only">Filter Tours by location</span>
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input
              id="tour-catalogue-location"
              value={location}
              onChange={(event) => onLocationChange(event.target.value)}
              placeholder="Location"
              className="clay-control h-11 rounded-xl pl-10"
              maxLength={120}
            />
          </label>
        </div>
      </div>
    </header>
  );
}
