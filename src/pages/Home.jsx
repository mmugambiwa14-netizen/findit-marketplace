import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { readStoredJson, removeStoredValue, writeStoredJson } from '@/lib/browserStorage';
import DiscoverCategoryGrid from '@/components/discover/DiscoverCategoryGrid';
import DiscoverHeader from '@/components/discover/DiscoverHeader';
import DiscoverSearch from '@/components/discover/DiscoverSearch';
import HomePeekRail from '@/components/discover/HomePeekRail';

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
    <div className="min-h-screen bg-background pb-10">
      <div className="page-shell max-w-5xl pt-5 sm:pt-7">
        <DiscoverSearch location={location} />
        <div className="mt-3">
          <DiscoverHeader location={location} onLocationChange={updateLocation} />
        </div>

        <section className="mt-8" aria-labelledby="discover-categories-title">
          <div className="mb-3">
            <h1 id="discover-categories-title" className="text-xl font-black tracking-tight sm:text-2xl">Browse categories</h1>
            <p className="mt-1 text-xs text-muted-foreground">Choose where you want to start</p>
          </div>
          <DiscoverCategoryGrid location={location} />
        </section>

        <HomePeekRail location={location} />

        <section className="mt-8 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:p-5" aria-label="FindIt buyer tools">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground sm:text-base">More context before you enquire</h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground sm:text-sm">Use Peeks, saved listings and private chats to make better-informed decisions.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
