import { Clapperboard, MapPin, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function TourCatalogueHeader({ query, location, onQueryChange, onLocationChange }) {
  return (
    <header className="locked-page-header">
      <div className="mx-auto max-w-3xl px-4 pb-4 pt-4 sm:pb-3.5 sm:pt-3.5">
        <div className="flex min-h-[58px] items-center gap-3.5">
          <span className="locked-icon-tile h-12 w-12 rounded-2xl"><Clapperboard className="h-5.5 w-5.5" /></span>
          <div className="min-w-0">
            <p className="findit-overline tracking-[0.17em]">See it before you visit</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.025em]">Peeks</h1>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_8.75rem] gap-2.5 sm:mt-3 sm:grid-cols-[1fr_0.55fr]">
          <label htmlFor="tour-catalogue-search" className="relative block">
            <span className="sr-only">Search Peeks</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="tour-catalogue-search" type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search Peeks" className="locked-control h-12 rounded-2xl pl-10 pr-10 text-base md:text-sm" maxLength={100} />
            <span className="sr-only">Search listings, sellers or locations</span>
            {query && <button type="button" aria-label="Clear Peek search" onClick={() => onQueryChange('')} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
          </label>
          <label htmlFor="tour-catalogue-location" className="relative block">
            <span className="sr-only">Filter Peeks by location</span>
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input id="tour-catalogue-location" value={location} onChange={(event) => onLocationChange(event.target.value)} placeholder="Anywhere" className="locked-control h-12 rounded-2xl pl-9 pr-2 text-base md:text-sm" maxLength={120} />
          </label>
        </div>
      </div>
    </header>
  );
}
