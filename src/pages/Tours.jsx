import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, Settings2, WifiOff } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import NotificationBell from '@/components/layout/NotificationBell';
import GlobalRefreshButton from '@/components/pwa/GlobalRefreshButton';
import ImmersivePeekSlide from '@/components/tours/ImmersivePeekSlide';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/AuthContext';
import { readStoredString, writeStoredString } from '@/lib/browserStorage';
import { featureFlags } from '@/lib/featureFlags';
import { getFavouriteIds } from '@/services/favouritesService';
import { getPublicTourFeedPage } from '@/services/listingToursService';
import { listingTourQueryKeys } from '@/services/listingTourQueryKeys';

const AUTOPLAY_KEY = 'findit:peek:autoplay';
const MUTE_KEY = 'findit:peek:mute-default';
const VALID_CATEGORIES = new Set(['all', 'property', 'car', 'machinery', 'service']);
const MAX_RESTORE_PAGES = 10;
const CATEGORY_OPTIONS = [
  ['all', 'For you'],
  ['property', 'Property'],
  ['car', 'Cars'],
  ['machinery', 'Machinery'],
  ['service', 'Services'],
];

export default function Tours() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const requestedCategory = params.get('category') || 'all';
  const requestedTourId = params.get('peek') || null;
  const category = VALID_CATEGORIES.has(requestedCategory) ? requestedCategory : 'all';
  const [autoplay, setAutoplay] = useState(() => readStoredString('local', AUTOPLAY_KEY, 'on') !== 'off');
  const [muteByDefault, setMuteByDefault] = useState(() => readStoredString('local', MUTE_KEY, 'on') !== 'off');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTourId, setActiveTourId] = useState(requestedTourId);
  const [savedOverrides, setSavedOverrides] = useState({});
  const feedRef = useRef(null);
  const restoredTourRef = useRef(null);

  const filters = useMemo(() => ({ category, query: '', location: '', limit: 8 }), [category]);
  const feed = useInfiniteQuery({
    queryKey: listingTourQueryKeys.publicFeed(filters),
    queryFn: ({ pageParam }) => getPublicTourFeedPage({ ...filters, cursor: pageParam || null }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const byId = new Map();
    for (const page of feed.data?.pages || []) {
      for (const item of page.items) byId.set(item.tourId, item);
    }
    return [...byId.values()];
  }, [feed.data]);

  const activeIndex = useMemo(() => items.findIndex((item) => item.tourId === activeTourId), [activeTourId, items]);
  const listingIds = useMemo(() => [...new Set(items.filter((item) => item.parentType === 'listing').map((item) => item.parentId))], [items]);
  const favourites = useQuery({
    queryKey: ['tour-feed-favourites', user?.id || null, listingIds],
    queryFn: () => getFavouriteIds(user.id, listingIds),
    enabled: Boolean(user && listingIds.length),
    staleTime: 30_000,
  });
  const savedSet = useMemo(() => new Set(favourites.data || []), [favourites.data]);

  useEffect(() => {
    if (!activeTourId && !requestedTourId && items[0]?.tourId) setActiveTourId(items[0].tourId);
  }, [activeTourId, items, requestedTourId]);

  useEffect(() => {
    if (!requestedTourId || restoredTourRef.current === requestedTourId) return;
    const targetExists = items.some((item) => item.tourId === requestedTourId);

    if (!targetExists) {
      const loadedPages = feed.data?.pages?.length || 0;
      if (feed.hasNextPage && !feed.isFetchingNextPage && loadedPages < MAX_RESTORE_PAGES) {
        feed.fetchNextPage();
      }
      return;
    }

    restoredTourRef.current = requestedTourId;
    setActiveTourId(requestedTourId);
    window.requestAnimationFrame(() => {
      feedRef.current?.querySelector(`[data-tour-id="${requestedTourId}"]`)?.scrollIntoView({ block: 'start' });
    });
  }, [feed, items, requestedTourId]);

  useEffect(() => {
    if (!activeTourId) return;
    setParams((current) => {
      if (current.get('peek') === activeTourId) return current;
      const next = new URLSearchParams(current);
      next.set('peek', activeTourId);
      return next;
    }, { replace: true });
  }, [activeTourId, setParams]);

  useEffect(() => {
    if (activeIndex < 0 || activeIndex < items.length - 2 || !feed.hasNextPage || feed.isFetchingNextPage) return;
    feed.fetchNextPage();
  }, [activeIndex, feed, items.length]);

  useEffect(() => {
    const viewport = feedRef.current;
    if (!viewport) return undefined;
    const stopKeyboardScroll = (event) => {
      if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' '].includes(event.key)) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      const direction = ['ArrowUp', 'PageUp'].includes(event.key) ? -1 : 1;
      const nextIndex = Math.max(0, Math.min(items.length - 1, (activeIndex < 0 ? 0 : activeIndex) + direction));
      viewport.querySelector(`[data-tour-id="${items[nextIndex]?.tourId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('keydown', stopKeyboardScroll);
    return () => window.removeEventListener('keydown', stopKeyboardScroll);
  }, [activeIndex, items]);

  const setVisibleTour = useCallback((tourId) => setActiveTourId((current) => current === tourId ? current : tourId), []);

  const advanceAfterEnd = useCallback((tourId) => {
    if (!autoplay) return;
    const currentIndex = items.findIndex((item) => item.tourId === tourId);
    const nextItem = items[currentIndex + 1];
    if (!nextItem) return;
    feedRef.current?.querySelector(`[data-tour-id="${nextItem.tourId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [autoplay, items]);

  const updateAutoplay = (enabled) => {
    setAutoplay(enabled);
    writeStoredString('local', AUTOPLAY_KEY, enabled ? 'on' : 'off');
  };

  const updateMuteDefault = (enabled) => {
    setMuteByDefault(enabled);
    writeStoredString('local', MUTE_KEY, enabled ? 'on' : 'off');
  };

  const changeCategory = (nextCategory) => {
    const next = new URLSearchParams(params);
    if (nextCategory === 'all') next.delete('category'); else next.set('category', nextCategory);
    next.delete('peek');
    setParams(next, { replace: true });
    restoredTourRef.current = null;
    setActiveTourId(null);
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 px-[var(--findit-page-gutter)] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <BrandLogo
            className="pointer-events-auto drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]"
            markClassName="h-8 w-8"
            wordmarkClassName="text-xl text-white"
          />
          <div className="pointer-events-auto flex items-center gap-1 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            <GlobalRefreshButton inline className="text-white/90 hover:bg-black/20 hover:text-white" />
            {user && featureFlags.essentialNotifications && (
              <NotificationBell className="text-white/90 hover:bg-black/20 hover:text-white" iconClassName="text-white" />
            )}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-[var(--findit-icon-button-size)] w-[var(--findit-icon-button-size)] items-center justify-center rounded-[var(--findit-control-radius)] text-white/90 hover:bg-black/20"
              aria-label={`Peek settings. Autoplay is ${autoplay ? 'on' : 'off'}`}
            >
              <Settings2 className="h-[var(--findit-icon-size)] w-[var(--findit-icon-size)]" />
            </button>
          </div>
        </div>

        <nav className="pointer-events-auto mt-3 flex max-w-full gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Peek categories">
          {CATEGORY_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => changeCategory(value)}
              className={`h-[var(--findit-control-height-sm)] shrink-0 rounded-full px-3 text-xs font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] ${category === value ? 'bg-white text-black' : 'text-white'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {feed.isLoading ? (
        <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>
      ) : feed.isError ? (
        <div className="flex h-full items-center justify-center px-5">
          <section className="max-w-sm rounded-3xl border border-white/10 bg-black/55 p-6 text-center backdrop-blur-xl">
            <WifiOff className="mx-auto h-7 w-7 text-blue-400" />
            <h1 className="mt-3 text-lg font-bold">Peeks are temporarily offline</h1>
            <p className="mt-2 text-sm text-white/65">Check your connection and try again.</p>
            <Button variant="secondary" className="mt-4" onClick={() => feed.refetch()}><RefreshCw />Try again</Button>
          </section>
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-full items-center justify-center px-5 text-center">
          <div><h1 className="text-xl font-bold">No Peeks here yet</h1><p className="mt-2 text-sm text-white/60">Try another category.</p></div>
        </div>
      ) : (
        <main ref={feedRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain" aria-label="Full-screen Peeks feed">
          {items.map((item, index) => (
            <ImmersivePeekSlide
              key={item.tourId}
              item={item}
              active={activeTourId === item.tourId}
              nearby={activeIndex < 0 ? index < 2 : Math.abs(index - activeIndex) <= 1}
              autoplay={autoplay}
              muteByDefault={muteByDefault}
              onVisible={setVisibleTour}
              onEnded={advanceAfterEnd}
              isSaved={savedOverrides[item.parentId] ?? savedSet.has(item.parentId)}
              onSavedChange={(id, saved) => setSavedOverrides((current) => ({ ...current, [id]: saved }))}
            />
          ))}
          {feed.isFetchingNextPage && <div className="flex h-20 snap-start items-center justify-center bg-black"><Loader2 className="h-5 w-5 animate-spin text-blue-400" /></div>}
        </main>
      )}

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-xl rounded-t-[1.75rem] border-white/10 bg-slate-950 text-white">
          <SheetHeader className="text-left">
            <SheetTitle className="text-white">Peeks settings</SheetTitle>
            <SheetDescription>Control how videos behave while you browse.</SheetDescription>
          </SheetHeader>
          <div className="mt-5 space-y-3">
            <label className="flex items-center justify-between rounded-[var(--findit-panel-radius)] border border-white/10 bg-white/5 p-4">
              <span><span className="block text-sm font-bold">Autoplay</span><span className="mt-1 block text-xs text-white/55">Play the visible Peek and continue when it ends.</span></span>
              <Switch checked={autoplay} onCheckedChange={updateAutoplay} />
            </label>
            <label className="flex items-center justify-between rounded-[var(--findit-panel-radius)] border border-white/10 bg-white/5 p-4">
              <span><span className="block text-sm font-bold">Muted by default</span><span className="mt-1 block text-xs text-white/55">Start each Peek without sound.</span></span>
              <Switch checked={muteByDefault} onCheckedChange={updateMuteDefault} />
            </label>
            <div className="rounded-[var(--findit-panel-radius)] border border-white/10 bg-white/5 p-4 text-xs leading-5 text-white/60">
              PeekaListing keeps only the current, previous, and next Peek ready. Other videos are released from memory, and playback pauses whenever the app goes into the background.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
