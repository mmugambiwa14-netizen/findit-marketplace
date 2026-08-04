import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, RefreshCw, Settings2, WifiOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ImmersivePeekSlide from '@/components/tours/ImmersivePeekSlide';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/AuthContext';
import { readStoredString, writeStoredString } from '@/lib/browserStorage';
import { getFavouriteIds } from '@/services/favouritesService';
import { getPublicTourFeedPage } from '@/services/listingToursService';
import { listingTourQueryKeys } from '@/services/listingTourQueryKeys';

const AUTOPLAY_KEY = 'findit:peek:autoplay';
const MUTE_KEY = 'findit:peek:mute-default';
const VALID_CATEGORIES = new Set(['all', 'property', 'car', 'machinery', 'service']);

export default function Tours() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const requestedCategory = params.get('category') || 'all';
  const category = VALID_CATEGORIES.has(requestedCategory) ? requestedCategory : 'all';
  const [autoplay, setAutoplay] = useState(() => readStoredString('local', AUTOPLAY_KEY, 'on') !== 'off');
  const [muteByDefault, setMuteByDefault] = useState(() => readStoredString('local', MUTE_KEY, 'on') !== 'off');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTourId, setActiveTourId] = useState(null);
  const [savedOverrides, setSavedOverrides] = useState({});
  const feedRef = useRef(null);

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
    if (!activeTourId && items[0]?.tourId) setActiveTourId(items[0].tourId);
  }, [activeTourId, items]);

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
    setParams(next, { replace: true });
    setActiveTourId(null);
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black text-white sm:top-[4.5rem]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => navigate(-1)} className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur-xl" aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="pointer-events-auto flex items-center gap-2">
          <button type="button" onClick={() => updateAutoplay(!autoplay)} className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 text-xs font-bold backdrop-blur-xl" aria-pressed={autoplay}>
            <span>Autoplay</span>
            <span className={autoplay ? 'text-blue-400' : 'text-white/55'}>{autoplay ? 'On' : 'Off'}</span>
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur-xl" aria-label="Peek settings">
            <Settings2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="absolute left-1/2 top-[max(4.4rem,calc(env(safe-area-inset-top)+3.6rem))] z-40 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Peek categories">
        {[
          ['all', 'For you'],
          ['property', 'Property'],
          ['car', 'Cars'],
          ['machinery', 'Machinery'],
          ['service', 'Services'],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => changeCategory(value)} className={`min-h-9 shrink-0 rounded-full px-3 text-[11px] font-bold ${category === value ? 'bg-white text-black' : 'text-white/70'}`}>
            {label}
          </button>
        ))}
      </nav>

      {feed.isLoading ? (
        <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>
      ) : feed.isError ? (
        <div className="flex h-full items-center justify-center px-5">
          <section className="max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
            <WifiOff className="mx-auto h-7 w-7 text-blue-400" />
            <h1 className="mt-3 text-lg font-bold">Peeks are temporarily offline</h1>
            <p className="mt-2 text-sm text-white/65">Check your connection and try again.</p>
            <Button variant="secondary" className="mt-4" onClick={() => feed.refetch()}><RefreshCw className="h-4 w-4" />Try again</Button>
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
              index={index}
              total={items.length}
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
            <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <span><span className="block text-sm font-bold">Autoplay</span><span className="mt-1 block text-xs text-white/55">Play the visible Peek and continue when it ends.</span></span>
              <Switch checked={autoplay} onCheckedChange={updateAutoplay} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <span><span className="block text-sm font-bold">Muted by default</span><span className="mt-1 block text-xs text-white/55">Start each Peek without sound.</span></span>
              <Switch checked={muteByDefault} onCheckedChange={updateMuteDefault} />
            </label>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-white/60">
              FindIt keeps only the current, previous, and next Peek ready. Other videos are released from memory, and playback pauses whenever the app goes into the background.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
