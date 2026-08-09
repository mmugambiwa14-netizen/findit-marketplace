import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ImageOff, LocateFixed, MapPin, RefreshCw, X } from 'lucide-react';
import { CATEGORY_VISUALS } from '@/components/discover/CategoryIcons';
import { cn } from '@/lib/utils';
import { loadMapLibre, mapTilerStyleUrl, registerOptionalStyleImageFallbacks } from '@/lib/mapProvider';
import { ZIMBABWE_MAP_CENTER } from '@/lib/marketConfig';
import '@/components/discover/discover-map-popup.css';

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
  const kind = listing._type || listing._kind || listing.kind || fallbackType;
  if (kind === 'service') return `/service/${listing.id}`;
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
    const match = Object.entries(CITY_COORDS).find(([city]) => label.includes(city));
    if (match) return match[1];
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

function listingKind(listing, fallbackType) {
  const candidate = listing._kind || listing._type || listing.kind || fallbackType;
  return CATEGORY_VISUALS[candidate] ? candidate : 'property';
}

function priceLabel(listing) {
  const kind = listing._kind || listing._type || listing.kind;
  if (kind === 'service' && (listing.pricing_type === 'quote' || listing.price == null)) return 'Contact for quote';
  if (listing.price == null) return 'Contact';
  const currency = listing.currency === 'USD' ? 'US$' : listing.currency || '';
  return `${currency} ${Number(listing.price).toLocaleString()}`.trim();
}

function listingImage(listing) {
  return listing.photos?.[0] || listing.photo_urls?.[0] || listing.cover_image_url || listing.image_url || '';
}

function listingPlace(listing) {
  return listing.publicLocation || listing.location_name || listing.city || 'Location available in listing';
}

function createCategoryMarker(item) {
  const visual = CATEGORY_VISUALS[item._kind];
  const Icon = visual.icon;
  const element = document.createElement('button');
  const pin = document.createElement('span');
  const iconSlot = document.createElement('span');

  element.type = 'button';
  element.className = 'findit-map-marker';
  element.dataset.category = item._kind;
  element.dataset.selected = 'false';
  element.style.setProperty('--marker-color', visual.color);
  element.setAttribute('aria-label', `Preview ${visual.label.toLowerCase()}: ${item.title}`);
  element.title = `${visual.label}: ${item.title}`;
  pin.className = 'findit-map-marker-pin';
  iconSlot.className = 'findit-map-marker-icon';
  pin.append(iconSlot);
  element.append(pin);

  const iconRoot = createRoot(iconSlot);
  iconRoot.render(<Icon className="h-6 w-6" />);
  return { element, iconRoot };
}

function MapListingPreview({ item, point, onOpen, onClose }) {
  const visual = CATEGORY_VISUALS[item._kind];
  const image = listingImage(item);
  return (
    <article className="findit-map-listing-preview" aria-label={`${item.title} preview`}>
      <button type="button" onClick={onClose} aria-label="Close listing preview" className="findit-map-preview-close">
        <X className="h-4 w-4" />
      </button>
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="findit-map-preview-image">
          {image ? (
            <img src={image} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center"><ImageOff className="h-6 w-6 text-muted-foreground" /></span>
          )}
          <span className="findit-map-preview-category">
            <visual.icon className="h-5 w-5" />
            {visual.label}
          </span>
        </div>
        <div className="p-3">
          <p className="text-base font-extrabold text-primary">{priceLabel(item)}</p>
          <h2 className="mt-0.5 line-clamp-2 text-sm font-bold text-foreground">{item.title}</h2>
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{listingPlace(item)}</p>
          {point.approximate && <p className="mt-1 text-[11px] text-amber-700">Approximate city location</p>}
          <span className="mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-bold text-primary-foreground">
            {item._kind === 'service' ? 'View service' : 'View listing'} <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </button>
    </article>
  );
}

function tuneDarkBasemap(map) {
  const layers = map.getStyle()?.layers || [];
  layers.forEach((layer) => {
    try {
      if (layer.id === 'background') map.setPaintProperty(layer.id, 'background-color', '#071a2c');
      if (layer.id === 'water') map.setPaintProperty(layer.id, 'fill-color', '#061d31');
      if (layer.type === 'line' && /^(highway|boundary|waterway)/.test(layer.id)) {
        map.setPaintProperty(layer.id, 'line-color', layer.id.includes('casing') ? '#15344b' : '#1e4a63');
      }
      if (layer.type === 'symbol' && layer.paint?.['text-color']) {
        map.setPaintProperty(layer.id, 'text-color', '#9caabd');
        if (layer.paint?.['text-halo-color']) map.setPaintProperty(layer.id, 'text-halo-color', '#071a2c');
      }
    } catch {
      // Provider layers may reject runtime paint changes; the map remains usable.
    }
  });
}

export default function SearchResultsMap({
  listings = [],
  type = 'property',
  compact = false,
  showResultsList = true,
  showSummary = true,
  showPopups = true,
  allowEmptyMap = false,
  ariaLabel = 'Mapped search results',
}) {
  const navigate = useNavigate();
  const mapNode = useRef(null);
  const [mapFailure, setMapFailure] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const markers = useMemo(() => listings
    .map((listing) => ({ listing: { ...listing, _kind: listingKind(listing, type) }, point: getPoint(listing) }))
    .filter((item) => item.point), [listings, type]);

  useEffect(() => {
    if (!mapNode.current || (markers.length === 0 && !allowEmptyMap)) return undefined;
    let cancelled = false;
    let map = null;
    let resizeObserver = null;
    let resizeTimer = null;
    let activePopup;
    let activePopupRoot;
    let activeMarkerElement;
    const markerHandles = [];
    const markerIconRoots = [];
    setMapFailure('');

    const closePreview = () => {
      activeMarkerElement?.setAttribute('data-selected', 'false');
      activeMarkerElement = undefined;
      activePopupRoot?.unmount();
      activePopupRoot = undefined;
      activePopup?.remove();
      activePopup = undefined;
    };

    const showPreview = (maplibregl, listing, point, markerElement) => {
      if (!showPopups) return;
      closePreview();
      markerElement.dataset.selected = 'true';
      activeMarkerElement = markerElement;
      const popupNode = document.createElement('div');
      activePopupRoot = createRoot(popupNode);
      activePopupRoot.render(
        <MapListingPreview
          item={listing}
          point={point}
          onOpen={() => navigate(detailPath(listing, type))}
          onClose={closePreview}
        />,
      );
      activePopup = new maplibregl.Popup({
        anchor: 'bottom',
        closeButton: false,
        closeOnClick: false,
        focusAfterOpen: false,
        offset: 48,
        maxWidth: 'none',
        className: 'findit-listing-map-popup',
      })
        .setLngLat([point.longitude, point.latitude])
        .setDOMContent(popupNode)
        .addTo(map);
    };

    const initialize = async () => {
      try {
        const maplibregl = await loadMapLibre();
        if (cancelled || !mapNode.current) return;
        map = new maplibregl.Map({
          container: mapNode.current,
          style: mapTilerStyleUrl(),
          center: ZIMBABWE_MAP_CENTER,
          zoom: 5.5,
          minZoom: 0,
          renderWorldCopies: false,
          attributionControl: true,
          dragRotate: false,
          pitchWithRotate: false,
          cooperativeGestures: false,
          touchPitch: false,
        });
        registerOptionalStyleImageFallbacks(map);
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
        map.on('error', () => {
          if (!cancelled) setMapFailure('Map data is temporarily unavailable. Listings remain available below.');
        });

        const bounds = new maplibregl.LngLatBounds();
        const hoverCapable = Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches);
        markers.forEach(({ listing, point }) => {
          const { element, iconRoot } = createCategoryMarker(listing);
          const marker = new maplibregl.Marker({ element, anchor: 'bottom', subpixelPositioning: true })
            .setLngLat([point.longitude, point.latitude])
            .addTo(map);
          element.addEventListener('click', (event) => {
            event.stopPropagation();
            showPreview(maplibregl, listing, point, element);
          });
          element.addEventListener('focus', () => showPreview(maplibregl, listing, point, element));
          if (hoverCapable) {
            element.addEventListener('mouseenter', () => showPreview(maplibregl, listing, point, element));
          }
          markerHandles.push(marker);
          markerIconRoots.push(iconRoot);
          bounds.extend([point.longitude, point.latitude]);
        });

        map.once('load', () => {
          if (cancelled || !map) return;
          tuneDarkBasemap(map);
          if (!bounds.isEmpty()) {
            map.fitBounds(bounds, {
              animate: false,
              maxZoom: markers.length === 1 ? 14 : 11,
              padding: compact ? { top: 72, right: 32, bottom: 48, left: 32 } : { top: 150, right: 38, bottom: 65, left: 38 },
            });
          }
        });
        map.on('click', closePreview);

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
      closePreview();
      resizeObserver?.disconnect();
      markerHandles.forEach((marker) => marker.remove());
      markerIconRoots.forEach((root) => root.unmount());
      map?.remove();
    };
  }, [allowEmptyMap, compact, markers, navigate, retryKey, showPopups, type]);

  if (!markers.length && !allowEmptyMap) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-12 text-center">
        <MapPin className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold">No mapped results</p>
        <p className="mt-1 text-xs text-muted-foreground">Choose another search area or browse these listings in list view.</p>
      </div>
    );
  }

  const mapPanel = (
    <div className={cn('locked-map-panel relative', compact && 'findit-listing-location-panel')}>
      <div
        ref={mapNode}
        role="region"
        aria-label={ariaLabel}
        className={cn('findit-discover-map', compact && 'findit-listing-location-map')}
      />
      {showSummary && <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl border border-border bg-background/88 px-3 py-2 text-xs shadow-lg backdrop-blur-xl">
        <p className="flex items-center gap-1.5 font-semibold"><LocateFixed className="h-3.5 w-3.5 text-primary" />{markers.length} mapped</p>
        <p className="mt-0.5 text-muted-foreground">Drag or pinch to explore</p>
      </div>}
      {!markers.length && allowEmptyMap && <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 rounded-xl border border-border bg-background/88 px-3 py-2 text-center text-xs text-muted-foreground shadow-lg backdrop-blur-xl">No exact public coordinates supplied. The map is centered on Zimbabwe.</div>}
      {mapFailure && (
        <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/95 p-3 text-xs shadow-lg backdrop-blur-xl">
          <p>{mapFailure}</p>
          <button type="button" className="inline-flex min-h-9 shrink-0 items-center gap-1 font-semibold text-primary" onClick={() => setRetryKey((value) => value + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}
    </div>
  );

  if (!showResultsList) return mapPanel;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {mapPanel}
      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {markers.map(({ listing, point }) => (
          <Link
            key={listing.id}
            to={detailPath(listing, type)}
            className="block rounded-xl border border-border bg-card p-3 text-sm transition-colors hover:border-border-strong"
          >
            <p className="line-clamp-2 font-semibold">{listing.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{[listingPlace(listing), priceLabel(listing)].filter(Boolean).join(' | ')}</p>
            {point.approximate && <p className="mt-1 text-[11px] text-amber-700">Approximate city location</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
