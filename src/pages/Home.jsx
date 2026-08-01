import { useState } from 'react';
import { Bell, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { readStoredJson, removeStoredValue, writeStoredJson } from '@/lib/browserStorage';
import { featureFlags } from '@/lib/featureFlags';
import DiscoverCategoryGrid from '@/components/discover/DiscoverCategoryGrid';
import DiscoverHeader from '@/components/discover/DiscoverHeader';
import DiscoverSearch from '@/components/discover/DiscoverSearch';
import HomePeekRail from '@/components/discover/HomePeekRail';

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

  const updateLocation = (nextLocation) => {
    const safeLocation = publicLocation(nextLocation);
    setLocation(safeLocation);
    if (safeLocation) writeStoredJson('local', LOCATION_STORAGE_KEY, safeLocation);
    else removeStoredValue('local', LOCATION_STORAGE_KEY);
  };

  return (
    <div className="findit-screen pb-10">
      <div className="page-shell max-w-5xl pt-5 sm:pt-7">
        <div className="mb-5 flex items-center justify-between md:hidden">
          <div>
            <p className="findit-overline">FindIt marketplace</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Discover</h1>
          </div>
          {featureFlags.essentialNotifications ? (
            <Link to="/notifications" aria-label="Open notifications" className="clay-icon h-11 w-11 text-foreground">
              <Bell className="h-5 w-5" />
            </Link>
          ) : (
            <span className="clay-icon h-11 w-11 text-muted-foreground" aria-hidden="true">
              <Bell className="h-5 w-5" />
            </span>
          )}
        </div>

        <DiscoverSearch location={location} />
        <div className="mt-3">
          <DiscoverHeader location={location} onLocationChange={updateLocation} />
        </div>

        <section className="mt-4" aria-labelledby="discover-categories-title">
          <div className="sr-only">
            <h2 id="discover-categories-title">Browse categories</h2>
          </div>
          <DiscoverCategoryGrid location={location} />
        </section>

        <HomePeekRail location={location} />

        <section className="clay-soft mt-7 flex items-center gap-3 rounded-2xl p-4 sm:p-5" aria-label="FindIt buyer tools">
          <span className="clay-icon h-11 w-11 shrink-0 border-primary/20 bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground sm:text-base">More context before you enquire</h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground sm:text-sm">Use Tours, saved listings and private chats to make better-informed decisions.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
