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
import HomePeekRail from '@/components/discover/HomePeekRail';
import BrandLogo from '@/components/BrandLogo';

const LOCATION_STORAGE_KEY = 'findit.discover-location';

function publicLocation(value) {
  if (!value || typeof value !== 'object' || typeof value.city !== 'string' || !value.city) return null;
  return {
    country: typeof value.country === 'string' ? value.country : '',
    countryName: typeof value.countryName === 'string' ? value.countryName : '',
    countryCode: typeof value.countryCode === 'string' ? value.countryCode : '',
    state: typeof value.state === 'string' ? value.state : '',
    stateName: typeof value.stateName === 'string' ? value.stateName : '',
    city: value.city,
    cityName: typeof value.cityName === 'string' ? value.cityName : '',
    placeType: typeof value.placeType === 'string' ? value.placeType : '',
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
    <div className="findit-screen">
      <div className="findit-hero-panel findit-discover-safe-top mx-auto w-full max-w-[1180px] px-4 pb-6 sm:px-6 lg:px-8">
        <h1 className="sr-only md:hidden">Find what you need, right where you are.</h1>
        <header className="relative mb-3 flex min-h-11 items-center justify-center md:hidden">
          <BrandLogo
            className="gap-2"
            markClassName="h-8 w-8"
            wordmarkClassName="text-[1.75rem] tracking-[-0.045em]"
          />
          {featureFlags.essentialNotifications ? (
            <Link to="/notifications" aria-label="Open notifications" className="findit-header-action absolute right-0">
              <Bell className="h-5 w-5" />
            </Link>
          ) : (
            <span className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground/65" aria-hidden="true"><Bell className="h-5 w-5" /></span>
          )}
        </header>

        <section className="hidden max-w-3xl pb-7 pt-7 md:block" aria-labelledby="discover-heading">
          <p className="findit-overline">Your local marketplace</p>
          <h1 id="discover-heading" className="mt-3 max-w-[680px] text-4xl font-black leading-[1.08] tracking-[-0.045em] text-foreground lg:text-[3.35rem]">
            Find what you need, right where you are.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground lg:text-lg">
            Explore homes, vehicles, equipment, and professional services in one trusted place.
          </p>
        </section>

        <div className="md:rounded-[1.65rem] md:border md:border-border/70 md:bg-card/45 md:p-3 md:shadow-[0_20px_60px_hsl(var(--clay-shadow-dark)/.1)] md:backdrop-blur-xl">
          <DiscoverSearch location={location} />

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3 md:grid-cols-[minmax(240px,360px)_auto] md:justify-between">
            <DiscoverHeader location={location} onLocationChange={updateLocation} />
            {featureFlags.maps && (
              <div className="locked-segmented-control grid h-12 grid-cols-2" role="group" aria-label="Discover view">
                <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="Show category list" className={cn('flex h-10 min-w-12 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground min-[400px]:w-[4.7rem]', view === 'list' && 'locked-segmented-active')}><List className="h-[18px] w-[18px]" /><span className="hidden min-[400px]:inline">List</span></button>
                <button type="button" onClick={() => setView('map')} aria-pressed={view === 'map'} aria-label="Show marketplace map" className={cn('flex h-10 min-w-12 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground min-[400px]:w-[4.7rem]', view === 'map' && 'locked-segmented-active')}><Map className="h-[18px] w-[18px]" /><span className="hidden min-[400px]:inline">Map</span></button>
              </div>
            )}
          </div>
        </div>

        <main className="mt-5 md:mt-7">
          {view === 'map' && featureFlags.maps ? (
            <DiscoverMapView location={location} />
          ) : (
            <section aria-labelledby="discover-categories-title">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="findit-overline">Discover</p>
                  <h2 id="discover-categories-title" className="mt-1 text-xl font-black tracking-[-0.025em] text-foreground sm:text-2xl">Browse categories</h2>
                </div>
                <p className="hidden max-w-sm text-right text-sm leading-6 text-muted-foreground sm:block">Everything local, organised around how you search.</p>
              </div>
              <DiscoverCategoryGrid location={location} />
            </section>
          )}
          <HomePeekRail location={location} />
        </main>
      </div>
    </div>
  );
}
