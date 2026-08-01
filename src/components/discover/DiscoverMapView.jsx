import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ImageOff, MapPin, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CATEGORY_VISUALS } from './CategoryIcons';
import { cn } from '@/lib/utils';
import { loadMapLibre, mapTilerStyleUrl } from '@/lib/mapProvider';
import { searchPublicListingsPage } from '@/services/publicListingsService';
import { getPublicServicesPage } from '@/services/servicesService';

const CATEGORY_KEYS = ['property', 'car', 'machinery', 'service'];
const CITY_COORDS = {
  harare: [-17.8216, 31.0492], bulawayo: [-20.1325, 28.6265], mutare: [-18.9707, 32.6709],
  gweru: [-19.4515, 29.8169], masvingo: [-20.0744, 30.8326], chitungwiza: [-18.0127, 31.0756],
  lagos: [6.5244, 3.3792], ikeja: [6.6018, 3.3515], lekki: [6.4698, 3.5852],
};

function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function coordinates(item) {
  const latitude = number(item.coordinates?.latitude ?? item.latitude);
  const longitude = number(item.coordinates?.longitude ?? item.longitude);
  if (latitude !== null && longitude !== null) return { latitude, longitude };
  const labels = [item.city, item.location_name, item.publicLocation, item.location_id].filter(Boolean).map((value) => String(value).toLowerCase());
  for (const label of labels) {
    const match = Object.entries(CITY_COORDS).find(([name]) => label.includes(name));
    if (match) return { latitude: match[1][0], longitude: match[1][1] };
  }
  return null;
}
function path(item) {
  if (item._kind === 'service') return `/service/${item.id}`;
  if (item._kind === 'car') return `/car/${item.id}`;
  if (item._kind === 'machinery') return `/machinery/${item.id}`;
  return `/property/${item.id}`;
}
function image(item) { return item.photos?.[0] || item.photo_urls?.[0] || item.cover_image_url || item.image_url || ''; }
function place(item) { return item.publicLocation || item.location_name || item.city || 'Location available in listing'; }
function price(item) {
  if (item._kind === 'service' && (item.pricing_type === 'quote' || item.price == null)) return 'Contact for quote';
  if (item.price == null) return 'Price on request';
  return `${item.currency === 'USD' || !item.currency ? 'US$' : item.currency} ${Number(item.price).toLocaleString()}`;
}

function createCategoryMarker(item, selected) {
  const visual = CATEGORY_VISUALS[item._kind];
  const Icon = visual.icon;
  const element = document.createElement('button');
  const pin = document.createElement('span');
  const iconSlot = document.createElement('span');

  element.type = 'button';
  element.className = 'findit-map-marker';
  element.dataset.category = item._kind;
  element.dataset.selected = selected ? 'true' : 'false';
  element.style.setProperty('--marker-color', visual.color);
  element.setAttribute('aria-label', `Open ${visual.label.toLowerCase()} listing: ${item.title}`);
  element.title = `${visual.label}: ${item.title}`;
  pin.className = 'findit-map-marker-pin';
  iconSlot.className = 'findit-map-marker-icon';
  pin.append(iconSlot);
  element.append(pin);

  const iconRoot = createRoot(iconSlot);
  iconRoot.render(<Icon className="h-5 w-5" />);
  return { element, iconRoot };
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
      // A provider layer can expose a paint property that MapLibre does not
      // allow to be changed at runtime; the base style remains usable.
    }
  });
}

function useItems(location) {
  const locationId = location?.city || '';
  const property = useQuery({ queryKey: ['discover-map', 'property', locationId], queryFn: () => searchPublicListingsPage({ kind: 'property', locationId }), staleTime: 60000 });
  const cars = useQuery({ queryKey: ['discover-map', 'car', locationId], queryFn: () => searchPublicListingsPage({ kind: 'car', locationId }), staleTime: 60000 });
  const machinery = useQuery({ queryKey: ['discover-map', 'machinery', locationId], queryFn: () => searchPublicListingsPage({ kind: 'machinery', locationId }), staleTime: 60000 });
  const services = useQuery({ queryKey: ['discover-map', 'service', locationId], queryFn: () => getPublicServicesPage({ locationId, limit: 24 }), staleTime: 60000 });
  const items = useMemo(() => [
    ...((property.data?.items || []).map((item) => ({ ...item, _kind: 'property' }))),
    ...((cars.data?.items || []).map((item) => ({ ...item, _kind: 'car' }))),
    ...((machinery.data?.items || []).map((item) => ({ ...item, _kind: 'machinery' }))),
    ...((services.data?.items || []).map((item) => ({ ...item, _kind: 'service' }))),
  ], [cars.data, machinery.data, property.data, services.data]);
  return { items, loading: property.isLoading || cars.isLoading || machinery.isLoading || services.isLoading };
}

export default function DiscoverMapView({ location }) {
  const navigate = useNavigate();
  const mapNode = useRef(null);
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [failure, setFailure] = useState('');
  const { items, loading } = useItems(location);
  const mapped = useMemo(() => items.map((item) => ({ item, point: coordinates(item) })).filter((entry) => entry.point), [items]);
  const visible = useMemo(() => category === 'all' ? mapped : mapped.filter(({ item }) => item._kind === category), [category, mapped]);
  const selected = mapped.find(({ item }) => item.id === selectedId)?.item || null;

  useEffect(() => {
    if (!mapNode.current || !visible.length) return undefined;
    let cancelled = false;
    let map;
    const markers = [];
    const markerIconRoots = [];
    setFailure('');
    (async () => {
      try {
        const maplibregl = await loadMapLibre();
        if (cancelled || !mapNode.current) return;
        map = new maplibregl.Map({ container: mapNode.current, style: mapTilerStyleUrl(), center: [visible[0].point.longitude, visible[0].point.latitude], zoom: 10, dragRotate: false, pitchWithRotate: false, cooperativeGestures: true });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
        const bounds = new maplibregl.LngLatBounds();
        visible.forEach(({ item, point }) => {
          const { element, iconRoot } = createCategoryMarker(item, item.id === selectedId);
          const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
            .setLngLat([point.longitude, point.latitude]).addTo(map);
          element.addEventListener('click', () => setSelectedId(item.id));
          markerIconRoots.push(iconRoot);
          markers.push(marker);
          bounds.extend([point.longitude, point.latitude]);
        });
        map.once('load', () => {
          if (cancelled) return;
          tuneDarkBasemap(map);
          map.fitBounds(bounds, { animate: false, padding: { top: 45, right: 38, bottom: selectedId ? 240 : 55, left: 38 }, maxZoom: visible.length === 1 ? 14 : 11 });
        });
        map.on('error', () => !cancelled && setFailure('Map tiles are temporarily unavailable.'));
      } catch { if (!cancelled) setFailure('The map could not load. Switch back to list view to continue.'); }
    })();
    return () => { cancelled = true; markerIconRoots.forEach((root) => root.unmount()); markers.forEach((marker) => marker.remove()); map?.remove(); };
  }, [selectedId, visible]);

  useEffect(() => { if (selectedId && !visible.some(({ item }) => item.id === selectedId)) setSelectedId(null); }, [selectedId, visible]);

  if (loading) return <div className="locked-map-panel flex min-h-[540px] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>;
  if (!mapped.length) return <div className="locked-map-panel flex min-h-[540px] flex-col items-center justify-center px-6 text-center"><MapPin className="h-9 w-9 text-primary" /><h2 className="mt-4 text-lg font-bold">No mapped results</h2><p className="mt-2 text-sm text-muted-foreground">Listings without public coordinates remain available in list view.</p></div>;

  return (
    <section className="space-y-3" aria-label="Discover marketplace map">
      <div className="locked-map-panel relative min-h-[540px]">
        <div ref={mapNode} className="h-[calc(100svh-270px)] min-h-[540px] max-h-[720px] w-full" />
        {failure && <div className="absolute inset-x-3 top-3 z-20 rounded-xl border border-border bg-background/94 px-3 py-2 text-xs shadow-lg backdrop-blur-xl">{failure}</div>}
        {selected && (
          <div className="locked-bottom-sheet absolute inset-x-0 bottom-0 z-30 p-3.5">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-muted-foreground/40" />
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Close preview" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground"><X className="h-5 w-5" /></button>
            <button type="button" onClick={() => navigate(path(selected))} className="grid w-full grid-cols-[112px_minmax(0,1fr)] gap-3 pr-8 text-left">
              <div className="h-28 overflow-hidden rounded-xl border border-border bg-muted">{image(selected) ? <img src={image(selected)} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center"><ImageOff className="h-6 w-6 text-muted-foreground" /></span>}</div>
              <div className="min-w-0 py-0.5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{CATEGORY_VISUALS[selected._kind].label}</p><p className="mt-1 text-lg font-extrabold text-primary">{price(selected)}</p><h2 className="line-clamp-1 text-base font-bold">{selected.title}</h2><p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{place(selected)}</p></div>
            </button>
            <button type="button" onClick={() => navigate(path(selected))} className="clay-button mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold">View full listing <ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      <div className="discover-map-rail surface-panel grid grid-cols-4 gap-1.5 p-2.5" role="group" aria-label="Filter map categories">
        {CATEGORY_KEYS.map((key) => {
          const visual = CATEGORY_VISUALS[key];
          const Icon = visual.icon;
          const active = category === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(active ? 'all' : key)}
              aria-pressed={active}
              className={cn('group min-w-0 rounded-xl border border-transparent p-1 text-left text-muted-foreground transition-colors', active && 'border-primary/45 bg-primary/10 text-primary')}
            >
              <span className="relative block aspect-[1.35] overflow-hidden rounded-lg border border-white/10 bg-surface-secondary">
                <img src={visual.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-105" />
                <span className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-primary backdrop-blur-sm"><Icon className="h-3.5 w-3.5" /></span>
              </span>
              <span className="mt-1 block truncate px-0.5 text-[10px] font-medium">{visual.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
