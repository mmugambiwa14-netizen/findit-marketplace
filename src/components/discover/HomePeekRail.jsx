import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MapPin, Play, RefreshCw, VideoOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { featureFlags } from '@/lib/featureFlags';
import { useCurrency } from '@/lib/CurrencyContext';
import ListingCard from '@/components/listings/ListingCard';
import { getPublicHomeListings } from '@/services/publicListingsService';
import { getPublicTourFeedPage, publicTourDetailPath } from '@/services/listingToursService';
import { listingTourQueryKeys } from '@/services/listingTourQueryKeys';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

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
    <SkeletonRegion className="space-y-3" label="Loading Peeks">
      {[1, 2].map((item) => (
        <div key={item} className="clay-card grid min-h-[112px] grid-cols-[108px_minmax(0,1fr)] overflow-hidden rounded-2xl sm:grid-cols-[140px_minmax(0,1fr)]">
          <Skeleton className="rounded-none" />
          <div className="space-y-2 p-3.5">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

function ListingFallbackSkeleton() {
  return (
    <SkeletonRegion className="flex gap-3 overflow-hidden pb-1" label="Loading latest listings">
      {[1, 2].map((item) => (
        <div key={item} className="clay-card w-[17.5rem] shrink-0 overflow-hidden rounded-2xl">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
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
  const fallback = useQuery({
    queryKey: ['public-home-listings-fallback', request.location],
    queryFn: () => getPublicHomeListings({ location: request.location, limit: 4 }),
    enabled: featureFlags.tours && feed.isError,
    staleTime: 60_000,
    retry: 1,
  });

  if (!featureFlags.tours) return null;
  if (feed.isLoading) {
    return (
      <section className="mt-7" aria-labelledby="home-recommended-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="home-recommended-title" className="findit-section-title">Peeks near you</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Watch the listing before you arrange a visit</p>
          </div>
        </div>
        <PeekSkeleton />
      </section>
    );
  }

  const items = feed.data?.items || [];
  if (feed.isError) {
    const fallbackItems = fallback.data?.items || [];
    if (fallback.isLoading) {
      return (
        <section className="mt-7" aria-labelledby="home-recommended-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="home-recommended-title" className="findit-section-title">Latest listings</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Peeks are temporarily unavailable; loading marketplace listings.</p>
            </div>
          </div>
          <ListingFallbackSkeleton />
        </section>
      );
    }

    if (fallbackItems.length > 0) {
      const listingScope = fallback.data?.locationMatched ? 'near you' : 'in Zimbabwe';
      return (
        <section className="mt-7" aria-labelledby="home-recommended-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="home-recommended-title" className="findit-section-title">Latest listings {listingScope}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Peeks are temporarily unavailable. The marketplace is still available.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => feed.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />Retry Peeks
            </Button>
          </div>
          <div className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {fallbackItems.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                type={listing.kind}
                layout="recommendation"
                className="w-[17.5rem] shrink-0"
              />
            ))}
          </div>
        </section>
      );
    }

    return (
      <section className="mt-7" aria-labelledby="home-recommended-title">
        <h2 id="home-recommended-title" className="findit-section-title">Peeks near you</h2>
        <div className="locked-list-row mt-3 flex items-center gap-3 p-3.5">
          <span className="locked-icon-tile h-10 w-10"><VideoOff className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold">Peeks and listings did not load</p><p className="mt-0.5 text-xs text-muted-foreground">Your location is still selected. Try again when your connection is stable.</p></div>
          <Button type="button" size="sm" variant="outline" onClick={() => { feed.refetch(); fallback.refetch(); }}><RefreshCw className="h-3.5 w-3.5" />Retry</Button>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mt-7" aria-labelledby="home-recommended-title">
        <h2 id="home-recommended-title" className="findit-section-title">Peeks near you</h2>
        <Link to="/peek" className="locked-list-row mt-3 flex min-h-20 items-center gap-3 p-3.5 hover:border-primary/30">
          <span className="locked-icon-tile h-10 w-10"><Play className="h-4 w-4 fill-current" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold">No local Peeks yet</span><span className="mt-0.5 block text-xs text-muted-foreground">Browse every available Peek.</span></span>
          <ArrowRight className="h-4 w-4 text-primary" />
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-7" aria-labelledby="home-recommended-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="home-recommended-title" className="findit-section-title">Peeks near you</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Watch the listing before you arrange a visit</p>
        </div>
        <Link to="/peek" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover">
          See all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
        {items.map((item) => (
          <Link
            key={item.tourId}
            to={publicTourDetailPath(item)}
            className="clay-card group grid min-h-[116px] grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-2xl hover:-translate-y-0.5 sm:grid-cols-[148px_minmax(0,1fr)]"
            aria-label={`Open ${item.title}`}
          >
            <div className="relative overflow-hidden bg-surface-secondary">
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" aria-hidden="true" />
              <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[9px] font-bold text-white shadow-lg">
                <Play className="h-3 w-3 fill-current" />
                Peek · {formatDuration(item.durationSeconds)}
              </span>
            </div>
            <div className="min-w-0 p-3.5">
              <p className="truncate text-sm font-extrabold text-primary">{peekPrice(item, format)}</p>
              <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-foreground">{item.title}</p>
              {item.publicLocation && (
                <p className="mt-2 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{item.publicLocation}</span>
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
