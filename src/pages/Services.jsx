import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { List, Loader2, Map as MapIcon, Plus, Search, X } from 'lucide-react';
import CategoryResultsHeader from '@/components/search/CategoryResultsHeader';
import SearchResultsMap from '@/components/search/SearchResultsMap';
import ServiceGrid from '@/components/services/ServiceGrid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { featureFlags } from '@/lib/featureFlags';
import { getPublicServicesPage } from '@/services/servicesService';
import { MapPanelSkeleton } from '@/components/loading/LoadingSkeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Services() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') || 'all';
  const query = searchParams.get('q') || '';
  const locationId = searchParams.get('location') || '';
  const locationName = searchParams.get('locationName') || '';
  const showMap = featureFlags.maps && searchParams.get('view') === 'map';
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => setSearchInput(query), [query]);
  useEffect(() => {
    const value = searchInput.trim();
    if (value === query) return undefined;
    const timeout = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set('q', value);
      else next.delete('q');
      setSearchParams(next, { replace: true });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query, searchInput, searchParams, setSearchParams]);

  const servicesQuery = useInfiniteQuery({
    queryKey: ['services', category, query, locationId],
    queryFn: ({ pageParam }) => getPublicServicesPage({ category, query, locationId, limit: 24, cursor: pageParam || null }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 30_000,
  });

  const services = useMemo(() => {
    const byId = new Map();
    for (const page of servicesQuery.data?.pages || []) {
      for (const service of page.items) byId.set(service.id, service);
    }
    return [...byId.values()];
  }, [servicesQuery.data]);

  const { isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = servicesQuery;

  const selectCategory = (value) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete('category');
    else next.set('category', value);
    setSearchParams(next);
  };

  const clearLocation = () => {
    const next = new URLSearchParams(searchParams);
    for (const key of ['location', 'locationName', 'country', 'province']) next.delete(key);
    setSearchParams(next);
  };

  const changeType = (nextType) => {
    if (nextType === 'service') return;
    const params = new URLSearchParams();
    params.set('type', nextType);
    for (const key of ['q', 'location', 'locationName', 'country', 'province']) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    navigate(`/search?${params.toString()}`);
  };

  const setView = (view) => {
    const next = new URLSearchParams(searchParams);
    if (view === 'map') next.set('view', 'map');
    else next.delete('view');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-[100dvh] bg-background md:pb-8">
      <header className="glass-bar sticky top-0 z-40 border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <CategoryResultsHeader
            type="service"
            category={category === 'all' ? '' : category}
            onTypeChange={changeType}
            onCategorySelect={selectCategory}
          />

          <div className="mt-4 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search services, providers or areas"
                aria-label="Search services"
                className="h-12 rounded-2xl pl-12 pr-12"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button asChild className="hidden h-12 shrink-0 rounded-xl sm:inline-flex">
              <Link to="/create-service"><Plus className="mr-2 h-4 w-4" />Offer service</Link>
            </Button>
          </div>
          {locationId && (
            <div className="mt-3 flex items-center">
              <button
                type="button"
                onClick={clearLocation}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15"
                aria-label={`Remove location filter${locationName ? ` for ${locationName}` : ''}`}
              >
                Near {locationName || 'selected location'}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Results</h2>
            {isLoading ? <Skeleton className="mt-1 h-4 w-32" /> : <p className="text-sm text-muted-foreground">Showing {services.length} service{services.length === 1 ? '' : 's'}</p>}
          </div>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            {featureFlags.maps && (
              <div className="flex items-center rounded-xl border border-border bg-card p-1" role="group" aria-label="Service result view">
                <button type="button" onClick={() => setView('list')} aria-pressed={!showMap} className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${!showMap ? 'bg-primary/12 text-primary' : 'text-muted-foreground'}`}><List className="h-4 w-4" />List</button>
                <button type="button" onClick={() => setView('map')} aria-pressed={showMap} className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${showMap ? 'bg-primary/12 text-primary' : 'text-muted-foreground'}`}><MapIcon className="h-4 w-4" />Map</button>
              </div>
            )}
            <Button asChild variant="outline" className="sm:hidden">
              <Link to="/create-service"><Plus className="mr-1.5 h-4 w-4" />Offer service</Link>
            </Button>
          </div>
        </div>

        {error ? (
          <div className="surface-panel px-4 py-12 text-center">
            <p className="font-semibold">We could not load services</p>
            <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : (
          <>
            {showMap ? (
              isLoading ? <MapPanelSkeleton label="Loading service map" /> : <SearchResultsMap listings={services.map((service) => ({ ...service, _type: 'service', city: service.location_name }))} type="service" />
            ) : <ServiceGrid services={services} isLoading={isLoading} />}
            {hasNextPage && (
              <div className="mt-6 flex justify-center">
                <Button type="button" variant="outline" className="min-w-48" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
                  {isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading</> : 'Load more services'}
                </Button>
              </div>
            )}
            {!hasNextPage && services.length > 0 && <p className="mt-6 text-center text-xs text-muted-foreground">You have reached the end of these results.</p>}
          </>
        )}
      </main>
    </div>
  );
}
