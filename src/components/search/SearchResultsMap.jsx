import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LocateFixed, MapPin, RefreshCw } from 'lucide-react';
import { loadMapLibre, mapTilerStyleUrl, registerOptionalStyleImageFallbacks } from '@/lib/mapProvider';

const CITY_COORDS = {
  harare: { latitude: -17.8216, longitude: 31.0492 },
  bulawayo: { latitude: -20.1325, longitude: 28.6265 },
  mutare: { latitude: -18.9707, longitude: 32.6709 },
  gweru: { latitude: -19.4515, longitude: 29.8169 },
  masvingo: { latitude: -20.0744, longitude: 30.8326 },
  chitungwiza: { latitude: -18.0127, longitude: 31.0756 },
  kadoma: { latitude: -18.3333, longitude: 29.9167 },
  kwekwe: { latitude: -18.9281, longitude: 29.8149 },
  'victoria falls': { latitude: -17.9243, longitude: 25.8567 },
  marondera: { latitude: -18.1853, longitude: 31.5519 },
  chinhoyi: { latitude: -17.3667, longitude: 30.2 },
  kariba: { latitude: -16.5167, longitude: 28.8 },
};

function detailPath(listing, fallbackType) {
  const kind = listing._type || listing.kind || fallbackType;
  if (kind === 'car') return `/car/${listing.id}`;
  if (kind === 'machinery') return `/machinery/${listing.id}`;
  return `/property/${listing.id}`;
}

function numericCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fallbackCoordinates(listing) {
  const labels = [listing.city, listing.location_id, listing.location_name, listing.publicLocation]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  for (const label of labels) {
    if (CITY_COORDS[label]) return CITY_COORDS[label];
  }
  return null;
}

function getPoint(listing) {
  const latitude = numericCoordinate(listing.coordinates?.latitude ?? listing.latitude);
  const longitude = numericCoordinate(listing.coordinates?.longitude ?? listing.longitude);
  if (latitude !== null && longitude !== null) return { latitude, longitude, approximate: false };
  const fallback = fallbackCoordinates(listing);
  return fallback ? { ...fallback, approximate: true } : null;
}

function priceLabel(listing) {
  if (listing.price == null) return 'Contact';
  const currency = listing.currency === 'USD' ? 'US$' : listing.currency || '';
  return `${currency} ${Number(listing.price).toLocaleString()}`.trim();
}

function popupContent(listing, point, onOpen) {
  const container = document.createElement('div');
  container.className = 'min-w-44 space-y-1 font-sans text-foreground';

  const title = document.createElement('p');
  title.className = 'font-semibold leading-5';
  title.textContent = listing.title;
  container.append(title);

  const detail = document.createElement('p');
  detail.className = 'text-xs text-muted-foreground';
  detail.textContent = [listing.city, priceLabel(listing)].filter(Boolean).join(' | ');
  container.append(detail);

  if (point.approximate) {
    const note = document.createElement('p');
    note.className = 'text-[11px] text-amber-700';
    note.textContent = 'Approximate city location';
    container.append(note);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mt-2 min-h-9 w-full rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground';
  button.textContent = 'View listing';
  button.addEventListener('click', onOpen);
  container.append(button);
  return container;
}

export default function SearchResultsMap({ listings = [], type = 'property' }) {
  const navigate = useNavigate();
  const mapNode = useRef(null);
  const [mapFailure, setMapFailure] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const markers = useMemo(() => listings
    .map((listing) => ({ listing, point: getPoint(listing) }))
    .filter((item) => item.point), [listings]);

  useEffect(() => {
    if (!mapNode.current || markers.length === 0) return undefined;
    let cancelled = false;
    let map = null;
    let resizeObserver = null;
    let resizeTimer = null;
    setMapFailure('');

    const initialize = async () => {
      try {
        const maplibregl = await loadMapLibre();
        if (cancelled || !mapNode.current) return;
        map = new maplibregl.Map({
          container: mapNode.current,
          style: mapTilerStyleUrl(),
          center: [29.1549, -19.0154],
          zoom: 5.5,
          attributionControl: true,
          dragRotate: false,
          pitchWithRotate: false,
          cooperativeGestures: true,
        });
        registerOptionalStyleImageFallbacks(map);
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
        map.on('error', () => {
          if (!cancelled) setMapFailure('Map data is temporarily unavailable. Listings remain available below.');
        });

        const bounds = new maplibregl.LngLatBounds();
        markers.forEach(({ listing, point }) => {
          const path = detailPath(listing, type);
          const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '260px', offset: 18 })
            .setDOMContent(popupContent(listing, point, () => navigate(path)));
          new maplibregl.Marker({
            color: point.approximate ? '#b45309' : '#087f5b',
            scale: 0.82,
          })
            .setLngLat([point.longitude, point.latitude])
            .setPopup(popup)
            .addTo(map);
          bounds.extend([point.longitude, point.latitude]);
        });

        map.once('load', () => {
          if (cancelled || !map || bounds.isEmpty()) return;
          map.fitBounds(bounds, {
            animate: false,
            maxZoom: markers.length === 1 ? 13 : 10,
            padding: 36,
          });
        });

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => map?.resize());
          resizeObserver.observe(mapNode.current);
        }
        resizeTimer = window.setTimeout(() => map?.resize(), 100);
      } catch {
        if (!cancelled) setMapFailure('The map could not load. Listings remain fully available in list view.');
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      map?.remove();
    };
  }, [markers, navigate, retryKey, type]);

  if (!markers.length) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong bg-card/40 px-4 py-12 text-center">
        <MapPin className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold">No mapped results</p>
        <p className="mt-1 text-xs text-muted-foreground">Choose another search area or browse these listings in list view.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-secondary">
        <div
          ref={mapNode}
          role="region"
          aria-label="Mapped listing results"
          className="h-[min(68vh,520px)] min-h-[390px] w-full"
        />
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-border bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
          <p className="flex items-center gap-1.5 font-semibold"><LocateFixed className="h-3.5 w-3.5 text-primary" />{markers.length} mapped</p>
          <p className="mt-0.5 text-muted-foreground">Drag or pinch to explore</p>
        </div>
        {mapFailure && (
          <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/95 p-3 text-xs shadow-md">
            <p>{mapFailure}</p>
            <button type="button" className="inline-flex min-h-9 shrink-0 items-center gap-1 font-semibold text-primary" onClick={() => setRetryKey((value) => value + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}
      </div>

      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {markers.map(({ listing, point }) => (
          <Link
            key={listing.id}
            to={detailPath(listing, type)}
            className="block rounded-xl border border-border bg-card p-3 text-sm transition-colors hover:border-border-strong"
          >
            <p className="line-clamp-2 font-semibold">{listing.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{[listing.city, priceLabel(listing)].filter(Boolean).join(' | ')}</p>
            {point.approximate && <p className="mt-1 text-[11px] text-amber-700">Approximate city location</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
