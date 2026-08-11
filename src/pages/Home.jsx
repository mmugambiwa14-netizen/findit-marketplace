import { useState } from 'react';
import { ArrowUpRight, Check, List, Map, MapPin, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { readStoredJson, removeStoredValue, writeStoredJson } from '@/lib/browserStorage';
import { featureFlags } from '@/lib/featureFlags';
import DiscoverCategoryGrid from '@/components/discover/DiscoverCategoryGrid';
import DiscoverHeader from '@/components/discover/DiscoverHeader';
import DiscoverMapView from '@/components/discover/DiscoverMapView';
import DiscoverSearch from '@/components/discover/DiscoverSearch';
import HomePeekRail from '@/components/discover/HomePeekRail';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';
import './home-redesign.css';

const LOCATION_STORAGE_KEY = 'findit.discover-location';
const DISCOVER_VIEWS = [
  { value: 'list', label: 'List', ariaLabel: 'Show category list', icon: List, hideLabelOnSmall: true },
  { value: 'map', label: 'Map', ariaLabel: 'Show marketplace map', icon: Map, hideLabelOnSmall: true },
];

function publicLocation(value) {
  if (!value || typeof value !== 'object' || typeof value.city !== 'string' || !value.city) return null;
  const countryCode = String(value.countryCode || '').trim().toUpperCase();
  const countryName = String(value.countryName || '').trim().toLowerCase();
  if ((countryCode && countryCode !== LAUNCH_COUNTRY_CODE) || (!countryCode && countryName && countryName !== 'zimbabwe')) return null;
  return {
    country: typeof value.country === 'string' ? value.country : '',
    countryName: typeof value.countryName === 'string' ? value.countryName : '',
    countryCode: LAUNCH_COUNTRY_CODE,
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
    <div className="peekalisting-discover-page">
      <div className="peekalisting-discover-shell">
        <div className="peekalisting-discover-context" aria-label="Marketplace context">
          <span>FindIt marketplace</span>
          <span aria-hidden="true">/</span>
          <strong>Find your next good thing</strong>
        </div>

        <section className="peekalisting-discover-hero" aria-labelledby="discover-heading">
          <div className="peekalisting-discover-hero-copy">
            <span className="peekalisting-design-eyebrow"><Sparkles className="h-3.5 w-3.5" />Curated for your point of view</span>
            <h1 id="discover-heading">Find the places worth a closer look.</h1>
            <p>A quieter way to discover homes, vehicles, equipment, and services that feel right for your next chapter.</p>
          </div>

          <div className="peekalisting-discover-tools">
            <div className="peekalisting-discover-search">
              <DiscoverSearch location={location} />
            </div>
            <div className="peekalisting-discover-location">
              <DiscoverHeader location={location} onLocationChange={updateLocation} />
              <span className="peekalisting-discover-location-note">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {location?.cityName ? `Showing ${location.cityName}` : 'Choose a location for closer results'}
              </span>
            </div>
            <div className="peekalisting-discover-stats" aria-label="Marketplace features">
              <div><strong>4</strong><span>live categories</span></div>
              <div><strong>2</strong><span>discovery views</span></div>
              <div><strong>Peeks</strong><span>before you visit</span></div>
            </div>
          </div>
        </section>

        <main className="peekalisting-discover-results">
          <section aria-labelledby="discover-categories-title">
            <div className="peekalisting-discover-section-heading">
              <div>
                <span className="peekalisting-design-eyebrow">Your shortlist</span>
                <h2 id="discover-categories-title">A few good places to begin.</h2>
                <p>Everything local, organised around how you search.</p>
              </div>
              <Link to="/post" className="clay-button inline-flex min-h-11 items-center gap-2 px-4 text-sm font-bold">
                List a place <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="peekalisting-discover-toolbar">
              <div className="peekalisting-discover-availability" aria-label="Included marketplace features">
                {['Property', 'Cars', 'Machinery', 'Services'].map((label) => (
                  <span key={label}><Check className="h-4 w-4" aria-hidden="true" />{label}</span>
                ))}
              </div>
              {featureFlags.maps && (
                <SegmentedControl
                  value={view}
                  onValueChange={setView}
                  options={DISCOVER_VIEWS}
                  ariaLabel="Discover view"
                  size="compact"
                  className="h-12 min-w-[6rem] min-[400px]:min-w-[9.4rem]"
                />
              )}
            </div>

            {view === 'map' && featureFlags.maps ? (
              <DiscoverMapView location={location} />
            ) : (
              <DiscoverCategoryGrid location={location} />
            )}
          </section>

          <HomePeekRail location={location} />

          <section className="peekalisting-discover-lower-grid" aria-label="Marketplace shortcuts">
            <Link to="/post" className="peekalisting-discover-creator-card">
              <div>
                <span className="peekalisting-design-eyebrow">Creator corner</span>
                <h2>Have a place people should see?</h2>
                <p>Turn your photos and details into a listing people can feel before they visit.</p>
              </div>
              <span className="clay-button inline-flex min-h-11 shrink-0 items-center gap-2 px-4 text-sm font-bold">Create a listing <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span>
            </Link>
            <aside className="peekalisting-discover-activity" aria-labelledby="discover-shortcuts-title">
              <div className="flex items-center justify-between gap-4">
                <span className="peekalisting-design-eyebrow" id="discover-shortcuts-title">Keep exploring</span>
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <Link to="/saved"><strong>Saved listings</strong><span>Keep your shortlist together <ArrowUpRight className="h-3.5 w-3.5" /></span></Link>
              <Link to="/services"><strong>Services near you</strong><span>Find skilled local help <ArrowUpRight className="h-3.5 w-3.5" /></span></Link>
              <Link to="/chats"><strong>Conversations</strong><span>Pick up where you left off <ArrowUpRight className="h-3.5 w-3.5" /></span></Link>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
