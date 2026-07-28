import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LocateFixed, MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  container.className = 'min-w-44 space-y-1 font-sans';

  const title = document.createElement('p');
  title.className = 'font-semibold leading-5 text-foreground';
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
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const markers = useMemo(() => listings
    .map((listing) => ({ listing, point: getPoint(listing) }))
    .filter((item) => item.point), [listings]);

  useEffect(() => {
    if (!mapNode.current || markers.length === 0) return undefined;
    setTilesUnavailable(false);

    const map = L.map(mapNode.current, {
      attributionControl: true,
      center: [-19.0154, 29.1549],
      scrollWheelZoom: false,
      zoom: 6,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    let tileFailures = 0;
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    })
      .on('tileerror', () => {
        tileFailures += 1;
        if (tileFailures >= 3) setTilesUnavailable(true);
      })
      .addTo(map);

    const bounds = L.latLngBounds([]);
    markers.forEach(({ listing, point }) => {
      const path = detailPath(listing, type);
      const marker = L.circleMarker([point.latitude, point.longitude], {
        bubblingMouseEvents: false,
        color: '#ffffff',
        fillColor: point.approximate ? '#b45309' : '#087f5b',
        fillOpacity: 0.96,
        radius: 9,
        weight: 3,
      }).addTo(map);
      marker.bindTooltip(priceLabel(listing), {
        className: 'findit-map-price',
        direction: 'top',
        offset: [0, -8],
      });
      marker.bindPopup(popupContent(listing, point, () => navigate(path)), {
        closeButton: true,
        maxWidth: 260,
        minWidth: 190,
      });
      bounds.extend([point.latitude, point.longitude]);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        animate: false,
        maxZoom: markers.length === 1 ? 13 : 10,
        padding: [28, 28],
      });
    }

    const resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    resizeObserver.observe(mapNode.current);
    const resizeTimer = window.setTimeout(() => map.invalidateSize({ animate: false }), 100);

    return () => {
      window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      tiles.off();
      map.remove();
    };
  }, [markers, navigate, type]);

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
        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg border border-border bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
          <p className="flex items-center gap-1.5 font-semibold"><LocateFixed className="h-3.5 w-3.5 text-primary" />{markers.length} mapped</p>
          <p className="mt-0.5 text-muted-foreground">Drag or pinch to explore</p>
        </div>
        {tilesUnavailable && (
          <p className="absolute inset-x-3 bottom-3 z-[500] rounded-lg bg-background/95 p-2 text-center text-xs shadow-md">
            Map tiles are slow to load. Listing pins remain available.
          </p>
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
