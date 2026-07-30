import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MapPin, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { featureFlags } from '@/lib/featureFlags';
import { useCurrency } from '@/lib/CurrencyContext';
import { getPublicTourFeedPage, publicTourDetailPath } from '@/services/listingToursService';
import { listingTourQueryKeys } from '@/services/listingTourQueryKeys';

function formatDuration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function peekPrice(item, format) {
  if (item.parentType === 'service' && (item.pricingType === 'quote' || item.price == null)) {
    return 'Contact for quote';
  }
  if (item.price == null) return 'Price on request';
  const prefix = item.parentType === 'service' && item.pricingType === 'starting_from' ? 'From ' : '';
  const suffix = item.parentType === 'service' && item.pricingType === 'hourly' ? '/hr' : '';
  return `${prefix}${format(item.price)}${suffix}`;
}

function PeekSkeleton() {
  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-hidden px-4 pb-1 sm:mx-0 sm:px-0" role="status" aria-label="Loading Peeks">
      {[1, 2, 3].map((item) => (
        <div key={item} className="w-[10.25rem] shrink-0 overflow-hidden rounded-2xl border border-border bg-card sm:w-[11.5rem]">
          <div className="aspect-[4/3] animate-pulse bg-surface-raised" />
          <div className="space-y-2 p-3">
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-raised" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-surface-raised" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface-raised" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePeekRail({ location }) {
  const { format } = useCurrency();
  const request = useMemo(() => ({
    category: 'all',
    query: '',
    location: location?.cityName || '',
    limit: 4,
  }), [location?.cityName]);
  const feed = useQuery({
    queryKey: [...listingTourQueryKeys.publicFeed(request), 'home'],
    queryFn: () => getPublicTourFeedPage({ ...request, cursor: null }),
    enabled: featureFlags.tours,
    staleTime: 60_000,
    retry: false,
  });

  if (!featureFlags.tours) return null;
  if (feed.isLoading) {
    return (
      <section className="mt-8" aria-labelledby="home-peeks-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="home-peeks-title" className="text-lg font-bold tracking-tight">Take a Peek</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">See listings before opening the details</p>
          </div>
        </div>
        <PeekSkeleton />
      </section>
    );
  }

  const items = feed.data?.items || [];
  if (feed.isError || items.length === 0) return null;

  return (
    <section className="mt-8" aria-labelledby="home-peeks-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="home-peeks-title" className="text-lg font-bold tracking-tight">Take a Peek</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">See listings before opening the details</p>
        </div>
        <Link to="/peek" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover">
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {items.map((item) => (
          <Link
            key={item.tourId}
            to={publicTourDetailPath(item)}
            className="group w-[10.25rem] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-[transform,border-color] hover:-translate-y-0.5 hover:border-border-strong sm:w-[11.5rem]"
            aria-label={`Take a Peek at ${item.title}`}
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-surface-secondary">
              {item.thumbnailUrl || item.coverImageUrl ? (
                <img
                  src={item.thumbnailUrl || item.coverImageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                />
              ) : (
                <div className="h-full w-full bg-surface-raised" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" aria-hidden="true" />
              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                {formatDuration(item.durationSeconds)}
              </span>
              <span className="absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white backdrop-blur-sm">
                <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
              </span>
            </div>
            <div className="p-3">
              <p className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-foreground">{item.title}</p>
              {item.publicLocation && (
                <p className="mt-1.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{item.publicLocation}</span>
                </p>
              )}
              <p className="mt-2 truncate text-sm font-extrabold text-primary">{peekPrice(item, format)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
