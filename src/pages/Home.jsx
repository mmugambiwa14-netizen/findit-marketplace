import { useState } from 'react';
import { Bell, List, Map } from 'lucide-react';
import { Link } from 'react-router-dom';
import { readStoredJson, removeStoredValue, writeStoredJson } from '@/lib/browserStorage';
import { featureFlags } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';
import DiscoverCategoryGrid from '@/components/discover/DiscoverCategoryGrid';
import DiscoverHeader from '@/components/discover/DiscoverHeader';
import DiscoverMapView from '@/components/discover/DiscoverMapView';
import DiscoverSearch from '@/components/discover/DiscoverSearch';
import BrandLogo from '@/components/BrandLogo';

const LOCATION_STORAGE_KEY = 'findit.discover-location';

function publicLocation(value) {
  if (!value || typeof value !== 'object' || typeof value.city !== 'string' || !value.city) return null;
  return {
    country: typeof value.country === 'string' ? value.country : '',
    state: typeof value.state === 'string' ? value.state : '',
    city: value.city,
    cityName: typeof value.cityName === 'string' ? value.cityName : '',
    source: value.source === 'device' ? 'device' : 'manual',
  };
}

function readSavedLocation() {
  return publicLocation(readStoredJson('local', LOCATION_STORAGE_KEY, null));
}

export default function Home() {
  const [location, setLocation] = useState(readSavedLocation);
  const [view, setView] = useState('list');

  const updateLocation = (nextLocation) => {
    const safeLocation = publicLocation(nextLocation);
    setLocation(safeLocation);
    if (safeLocation) writeStoredJson('local', LOCATION_STORAGE_KEY, safeLocation);
    else removeStoredValue('local', LOCATION_STORAGE_KEY);
  };

  return (
    <div className="findit-screen pb-24">
      <div className="mx-auto w-full max-w-[510px] px-4 pb-5 pt-4 sm:pt-6">
        <header className="relative mb-4 flex min-h-12 items-center justify-center">
          <BrandLogo
            className="gap-2"
            markClassName="h-8 w-8"
            wordmarkClassName="text-[1.75rem] tracking-[-0.045em]"
          />
          {featureFlags.essentialNotifications ? (
            <Link to="/notifications" aria-label="Open notifications" className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-xl text-foreground hover:bg-muted/60">
              <Bell className="h-5 w-5" />
            </Link>
          ) : (
            <span className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground" aria-hidden="true"><Bell className="h-5 w-5" /></span>
          )}
        </header>

        <DiscoverSearch location={location} />

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <DiscoverHeader location={location} onLocationChange={updateLocation} />
          {featureFlags.maps && (
            <div className="locked-segmented-control grid h-12 grid-cols-2" role="group" aria-label="Discover view">
              <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="Show category list" className={cn('flex h-10 min-w-12 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground min-[400px]:w-[4.7rem]', view === 'list' && 'locked-segmented-active')}><List className="h-[18px] w-[18px]" /><span className="hidden min-[400px]:inline">List</span></button>
              <button type="button" onClick={() => setView('map')} aria-pressed={view === 'map'} aria-label="Show marketplace map" className={cn('flex h-10 min-w-12 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground min-[400px]:w-[4.7rem]', view === 'map' && 'locked-segmented-active')}><Map className="h-[18px] w-[18px]" /><span className="hidden min-[400px]:inline">Map</span></button>
            </div>
          )}
        </div>

        <main className="mt-4">
          {view === 'map' && featureFlags.maps ? (
            <DiscoverMapView location={location} />
          ) : (
            <section aria-labelledby="discover-categories-title">
              <h1 id="discover-categories-title" className="sr-only">Browse FindIt categories</h1>
              <DiscoverCategoryGrid location={location} />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
