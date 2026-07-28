import { readStoredJson, writeStoredJson } from '@/lib/browserStorage';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Film, Loader2, RotateCcw } from 'lucide-react';
import TourCard from '@/components/tours/TourCard';
import TourCatalogueHeader from '@/components/tours/TourCatalogueHeader';
import TourCategoryChips from '@/components/tours/TourCategoryChips';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { getFavouriteIds } from '@/services/favouritesService';
import { getPublicTourFeedPage } from '@/services/listingToursService';
import { listingTourQueryKeys } from '@/services/listingTourQueryKeys';

const RESTORE_KEY = 'findit:tours:catalogue-state';
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
    setQuery((current) => current === nextQuery ? current : nextQuery);
    setLocation((current) => current === nextLocation ? current : nextLocation);
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

  return (
    <div className="min-h-screen bg-background pb-24">
      <TourCatalogueHeader query={query} location={location} onQueryChange={setQuery} onLocationChange={setLocation} />
      <main className="mx-auto max-w-3xl">
        <TourCategoryChips value={category} onChange={changeCategory} />

        {feed.isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center" role="status"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="sr-only">Loading Tours</span></div>
        ) : feed.isError ? (
          <section className="mx-4 mt-8 rounded-3xl border border-border bg-card px-6 py-14 text-center">
            <RotateCcw className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-bold">Tours could not be loaded</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your search and filters have been preserved.</p>
            <Button variant="outline" className="mt-5" onClick={() => feed.refetch()}>Try again</Button>
          </section>
        ) : items.length === 0 ? (
          <section className="mx-4 mt-8 rounded-3xl border border-border bg-card px-6 py-14 text-center">
            <Film className="mx-auto h-9 w-9 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-bold">No matching Tours</h2>
            <p className="mt-2 text-sm text-muted-foreground">Try another category, search or location.</p>
          </section>
        ) : (
          <section aria-label="Tour catalogue" className="space-y-5 px-4 pb-8">
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
            {feed.hasNextPage && (
              <div className="flex justify-center py-3">
                <Button variant="outline" className="min-w-48" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
                  {feed.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : 'Load more Tours'}
                </Button>
              </div>
            )}
            {!feed.hasNextPage && items.length > 0 && <p className="py-3 text-center text-xs text-muted-foreground">You have reached the end of these Tours.</p>}
          </section>
        )}
      </main>
    </div>
  );
}
