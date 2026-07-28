import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const CITY_COORDS = {
  harare: { latitude: -17.8216, longitude: 31.0492 },
  bulawayo: { latitude: -20.1325, longitude: 28.6265 },
  mutare: { latitude: -18.9707, longitude: 32.6709 },
  gweru: { latitude: -19.4515, longitude: 29.8169 },
  masvingo: { latitude: -20.0744, longitude: 30.8326 },
  chitungwiza: { latitude: -18.0127, longitude: 31.0756 },
  kadoma: { latitude: -18.3333, longitude: 29.9167 },
  kwekwe: { latitude: -18.9281, longitude: 29.8149 },
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

function boundsFor(points) {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latPad = Math.max((maxLat - minLat) * 0.18, 0.08);
  const lngPad = Math.max((maxLng - minLng) * 0.18, 0.08);
  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}

function positionInBounds(point, bounds) {
  const x = ((point.longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
  const y = (1 - ((point.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat))) * 100;
  return {
    left: `${Math.min(94, Math.max(6, x))}%`,
    top: `${Math.min(90, Math.max(10, y))}%`,
  };
}

function priceLabel(listing) {
  if (listing.price == null) return 'Contact';
  const currency = listing.currency === 'USD' ? 'US$' : listing.currency || '';
  return `${currency} ${Number(listing.price).toLocaleString()}`.trim();
}

export default function SearchResultsMap({ listings = [], type = 'property' }) {
  const markers = listings
    .map((listing) => ({ listing, point: getPoint(listing) }))
    .filter((item) => item.point);

  if (!markers.length) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong bg-card/40 px-4 py-12 text-center">
        <MapPin className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold">No mapped results</p>
        <p className="mt-1 text-xs text-muted-foreground">Add a city or coordinates to these listings to place them on the map.</p>
      </div>
    );
  }

  const bounds = boundsFor(markers.map((item) => item.point));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div
        className="relative min-h-[360px] overflow-hidden rounded-xl border border-border bg-[#dbe7dd]"
        aria-label="Mapped listing results"
      >
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(39,78,58,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(39,78,58,0.14)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="absolute inset-x-0 top-[18%] h-10 rotate-[-8deg] bg-[#f4efe5]/90" />
        <div className="absolute bottom-[22%] left-[-10%] h-12 w-[120%] rotate-[7deg] bg-[#f4efe5]/90" />
        <div className="absolute inset-y-0 left-[42%] w-10 rotate-[4deg] bg-[#f4efe5]/85" />
        <div className="absolute left-5 top-5 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs shadow-sm">
          <p className="font-semibold">{markers.length} mapped</p>
          <p className="text-muted-foreground">Local preview</p>
        </div>

        {markers.map(({ listing, point }, index) => {
          const position = positionInBounds(point, bounds);
          return (
            <Link
              key={listing.id}
              to={detailPath(listing, type)}
              aria-label={`Open ${listing.title} on map`}
              className="group absolute -translate-x-1/2 -translate-y-full"
              style={position}
            >
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110',
                  point.approximate && 'bg-amber-600',
                )}
              >
                <MapPin className="h-5 w-5 fill-current" />
              </span>
              <span className="absolute left-1/2 top-11 hidden w-48 -translate-x-1/2 rounded-lg border border-border bg-background p-2 text-left text-xs shadow-lg group-hover:block group-focus-visible:block">
                <span className="block truncate font-semibold">{listing.title}</span>
                <span className="mt-0.5 block text-muted-foreground">{priceLabel(listing)}</span>
                {point.approximate && <span className="mt-1 block text-amber-600">Approximate city pin</span>}
              </span>
              <span className="sr-only">Result {index + 1}</span>
            </Link>
          );
        })}
      </div>

      <div className="space-y-2">
        {markers.map(({ listing, point }) => (
          <Link
            key={listing.id}
            to={detailPath(listing, type)}
            className="block rounded-xl border border-border bg-card p-3 text-sm transition-colors hover:border-border-strong"
          >
            <p className="line-clamp-2 font-semibold">{listing.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{[listing.city, priceLabel(listing)].filter(Boolean).join(' · ')}</p>
            {point.approximate && <p className="mt-1 text-[11px] text-amber-600">Approximate city location</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
