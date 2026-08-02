import { readStoredJson, writeStoredJson } from '@/lib/browserStorage';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clapperboard, Loader2, RefreshCw, SearchX, WifiOff } from 'lucide-react';
import TourCard from '@/components/tours/TourCard';
import TourCatalogueHeader from '@/components/tours/TourCatalogueHeader';
import TourCategoryChips from '@/components/tours/TourCategoryChips';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { getFavouriteIds } from '@/services/favouritesService';
import { getPublicTourFeedPage } from '@/services/listingToursService';
import { listingTourQueryKeys } from '@/services/listingTourQueryKeys';

const RESTORE_KEY = 'findit:peek:catalogue-state';
const VALID_CATEGORIES = new Set(['all', 'property', 'car', 'machinery', 'service']);

function readRestoration() {
  return readStoredJson('session', RESTORE_KEY, {});
}

export default function Tours() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const initialRestoration = useRef(readRestoration());
  const initialFilterKey = useRef(JSON.stringify({
    q: params.get('q') || '',
    location: params.get('location') || '',
    category: params.get('category') || 'all',
  }));
  const [query, setQuery] = useState(params.get('q') || '');
  const [location, setLocation] = useState(params.get('location') || '');
  const requestedCategory = params.get('category') || 'all';
  const category = VALID_CATEGORIES.has(requestedCategory) ? requestedCategory : 'all';
  const deferredQuery = useDeferredValue(query.trim());
  const deferredLocation = useDeferredValue(location.trim());
  const [activeTourId, setActiveTourId] = useState(() => initialRestoration.current.activeTourId || null);
  const [restorePageCount, setRestorePageCount] = useState(() => {
    const state = initialRestoration.current;
    const stateFilterKey = JSON.stringify(state.filters || {});
    if (stateFilterKey !== initialFilterKey.current) return 1;
    return Math.min(10, Math.max(1, Number(state.pageCount) || 1));
  });
  const restored = useRef(false);
  const paramsKey = params.toString();

  useEffect(() => {
    const current = new URLSearchParams(paramsKey);
    const nextQuery = current.get('q') || '';
    const nextLocation = current.get('location') || '';
    setQuery((currentValue) => currentValue === nextQuery ? currentValue : nextQuery);
    setLocation((currentValue) => currentValue === nextLocation ? currentValue : nextLocation);
  }, [paramsKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (query.trim()) next.set('q', query.trim()); else next.delete('q');
        if (location.trim()) next.set('location', location.trim()); else next.delete('location');
        if (!VALID_CATEGORIES.has(next.get('category') || 'all')) next.delete('category');
        return next;
      }, { replace: true });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, location, setParams]);

  const filters = useMemo(() => ({ category, query: deferredQuery, location: deferredLocation, limit: 8 }), [category, deferredQuery, deferredLocation]);
  const filterKey = useMemo(() => JSON.stringify({ q: deferredQuery, location: deferredLocation, category }), [category, deferredLocation, deferredQuery]);

  const previousFilterKey = useRef(filterKey);
  useEffect(() => {
    if (previousFilterKey.current === filterKey) return;
    previousFilterKey.current = filterKey;
    setRestorePageCount(1);
    setActiveTourId(null);
    restored.current = true;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [filterKey]);

  const feed = useInfiniteQuery({
    queryKey: listingTourQueryKeys.publicFeed(filters),
    queryFn: ({ pageParam }) => getPublicTourFeedPage({ ...filters, cursor: pageParam || null }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const byId = new Map();
    for (const page of feed.data?.pages || []) for (const item of page.items) byId.set(item.tourId, item);
    return [...byId.values()];
  }, [feed.data]);
  const listingIds = useMemo(() => [...new Set(items.filter((item) => item.parentType === 'listing').map((item) => item.parentId))], [items]);
  const favourites = useQuery({
    queryKey: ['tour-feed-favourites', user?.id || null, listingIds],
    queryFn: () => getFavouriteIds(user.id, listingIds),
    enabled: Boolean(user && listingIds.length),
    staleTime: 30_000,
  });
  const [savedOverrides, setSavedOverrides] = useState({});
  const savedSet = useMemo(() => new Set(favourites.data || []), [favourites.data]);
  const loadedPageCount = feed.data?.pages?.length || 0;
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = feed;

  useEffect(() => setSavedOverrides({}), [user?.id]);

  useEffect(() => {
    if (loadedPageCount >= restorePageCount || !hasNextPage || isFetchingNextPage || isLoading) return;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, loadedPageCount, restorePageCount]);

  useEffect(() => {
    const restorationComplete = loadedPageCount >= restorePageCount || !hasNextPage;
    if (restored.current || !items.length || !restorationComplete) return;
    restored.current = true;
    const state = initialRestoration.current;
    requestAnimationFrame(() => window.scrollTo({ top: Number(state.scrollY) || 0, behavior: 'auto' }));
  }, [hasNextPage, items.length, loadedPageCount, restorePageCount]);

  useEffect(() => {
    const save = () => writeStoredJson('session', RESTORE_KEY, {
      scrollY: window.scrollY,
      activeTourId,
      pageCount: Math.max(1, loadedPageCount),
      filters: { q: deferredQuery, location: deferredLocation, category },
    });
    window.addEventListener('pagehide', save);
    return () => { save(); window.removeEventListener('pagehide', save); };
  }, [activeTourId, category, deferredLocation, deferredQuery, loadedPageCount]);

  const changeCategory = (nextCategory) => {
    setActiveTourId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const next = new URLSearchParams(params);
    if (nextCategory === 'all') next.delete('category'); else next.set('category', nextCategory);
    setParams(next, { replace: true });
  };

  const resetFilters = () => {
    setQuery('');
    setLocation('');
    setActiveTourId(null);
    setParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className="findit-screen">
      <TourCatalogueHeader query={query} location={location} onQueryChange={setQuery} onLocationChange={setLocation} />
      <main className="mx-auto max-w-3xl">
        <TourCategoryChips value={category} onChange={changeCategory} />

        {feed.isLoading ? (
          <PeekLoading />
        ) : feed.isError ? (
          <section className="clay-card mx-4 mt-4 rounded-3xl px-6 py-12 text-center">
            <span className="locked-icon-tile mx-auto h-12 w-12"><WifiOff className="h-5 w-5" /></span>
            <h2 className="mt-4 text-lg font-bold">Peeks are temporarily offline</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">We kept your search and filters. Reconnect and try again—your place will not be lost.</p>
            <Button variant="outline" className="clay-control mt-5" onClick={() => feed.refetch()}><RefreshCw className="h-4 w-4" />Try again</Button>
          </section>
        ) : items.length === 0 ? (
          <section className="clay-card mx-4 mt-4 rounded-3xl px-6 py-12 text-center">
            <span className="locked-icon-tile mx-auto h-12 w-12"><SearchX className="h-5 w-5" /></span>
            <h2 className="mt-4 text-lg font-bold">No matching Peeks</h2>
            <p className="mt-2 text-sm text-muted-foreground">Clear the filters or try a nearby place.</p>
            {(query || location || category !== 'all') && <Button variant="outline" className="clay-control mt-5" onClick={resetFilters}>Show all Peeks</Button>}
          </section>
        ) : (
          <section aria-label="Peek catalogue" className="px-4 pb-8">
            <div className="mb-3 mt-2 flex items-end justify-between gap-3">
              <div><p className="findit-overline">Watch and decide</p><h2 className="findit-section-title mt-0.5">{deferredLocation ? `Peeks in ${deferredLocation}` : 'Latest Peeks'}</h2></div>
              <p className="shrink-0 text-xs text-muted-foreground">{items.length} shown</p>
            </div>
            <div className="space-y-4">
              {items.map((item) => (
                <TourCard
                  key={item.tourId}
                  item={item}
                  active={activeTourId === item.tourId}
                  onActivate={setActiveTourId}
                  isSaved={savedOverrides[item.parentId] ?? savedSet.has(item.parentId)}
                  onSavedChange={(id, saved) => setSavedOverrides((current) => ({ ...current, [id]: saved }))}
                  onReported={(tourId) => setActiveTourId((current) => current === tourId ? null : current)}
                />
              ))}
            </div>
            {feed.hasNextPage && (
              <div className="flex justify-center py-5">
                <Button variant="outline" className="clay-control min-w-48" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
                  {feed.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : 'Load more Peeks'}
                </Button>
              </div>
            )}
            {!feed.hasNextPage && items.length > 0 && <p className="flex items-center justify-center gap-1.5 py-5 text-center text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />You have seen every matching Peek.</p>}
          </section>
        )}
      </main>
    </div>
  );
}

function PeekLoading() {
  return (
    <div className="space-y-4 px-4 pb-8 pt-2" role="status" aria-label="Loading Peeks">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Clapperboard className="h-4 w-4 animate-pulse text-primary" />Finding the best Peeks…</div>
      {[1, 2].map((item) => (
        <div key={item} className="clay-card overflow-hidden rounded-2xl">
          <div className="aspect-[16/10] animate-pulse bg-surface-raised" />
          <div className="grid grid-cols-4 gap-2 p-3">
            {[1, 2, 3, 4].map((part) => <div key={part} className="h-9 animate-pulse rounded-xl bg-surface-raised" />)}
          </div>
        </div>
      ))}
    </div>
  );
}
