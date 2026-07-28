import { useState } from 'react';
import { readStoredJson, removeStoredValue, writeStoredJson } from '@/lib/browserStorage';
import DiscoverCategoryGrid from '@/components/discover/DiscoverCategoryGrid';
import DiscoverHeader from '@/components/discover/DiscoverHeader';
import DiscoverSearch from '@/components/discover/DiscoverSearch';

const LOCATION_STORAGE_KEY = 'findit.discover-location';

function readSavedLocation() {
  const value = readStoredJson('local', LOCATION_STORAGE_KEY, null);
  return value && typeof value === 'object' && value.city ? value : null;
}

export default function Home() {
  const [location, setLocation] = useState(readSavedLocation);

  const updateLocation = (nextLocation) => {
    setLocation(nextLocation);
    if (nextLocation) writeStoredJson('local', LOCATION_STORAGE_KEY, nextLocation);
    else removeStoredValue('local', LOCATION_STORAGE_KEY);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="page-shell max-w-5xl">
        <DiscoverHeader location={location} onLocationChange={updateLocation} />

        <section className="pb-7 pt-10 sm:pb-9 sm:pt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Discover FindIt</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black leading-[1.08] tracking-[-0.035em] sm:text-5xl">
            Find the right asset, place or service.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Start with a category, then narrow results using search and practical filters.
          </p>
        </section>

        <DiscoverSearch location={location} />

        <section className="mt-7" aria-labelledby="discover-categories-title">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id="discover-categories-title" className="text-lg font-bold">Browse categories</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Four focused marketplace paths</p>
            </div>
          </div>
          <DiscoverCategoryGrid location={location} />
        </section>
      </div>
    </div>
  );
}
