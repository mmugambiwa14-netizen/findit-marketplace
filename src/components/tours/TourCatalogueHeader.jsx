import { Clapperboard, MapPin, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function TourCatalogueHeader({ query, location, onQueryChange, onLocationChange }) {
  return (
    <header className="locked-page-header">
      <div className="mx-auto max-w-3xl px-4 pb-3 pt-3">
        <div className="flex items-center gap-3">
          <span className="locked-icon-tile h-10 w-10"><Clapperboard className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="findit-overline">See it before you visit</p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight">Peeks</h1>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_8.75rem] gap-2 sm:grid-cols-[1fr_0.55fr]">
          <label htmlFor="tour-catalogue-search" className="relative block">
            <span className="sr-only">Search Peeks</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="tour-catalogue-search" type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search Peeks" className="locked-control h-11 rounded-xl pl-10 pr-10" maxLength={100} />
            <span className="sr-only">Search listings, sellers or locations</span>
            {query && <button type="button" aria-label="Clear Peek search" onClick={() => onQueryChange('')} className="absolute right-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
          </label>
          <label htmlFor="tour-catalogue-location" className="relative block">
            <span className="sr-only">Filter Peeks by location</span>
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input id="tour-catalogue-location" value={location} onChange={(event) => onLocationChange(event.target.value)} placeholder="Anywhere" className="locked-control h-11 rounded-xl pl-9 pr-2 text-xs" maxLength={120} />
          </label>
        </div>
      </div>
    </header>
  );
}
