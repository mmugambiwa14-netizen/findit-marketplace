import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, RefreshCw, Settings2, WifiOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ImmersivePeekCard from '@/components/tours/ImmersivePeekCard';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/AuthContext';
import { readStoredString, writeStoredString } from '@/lib/browserStorage';
import { getFavouriteIds } from '@/services/favouritesService';
import { getPublicTourFeedPage } from '@/services/listingToursService';
import { listingTourQueryKeys } from '@/services/listingTourQueryKeys';

const AUTOPLAY_KEY = 'findit:peek:autoplay';
const VALID_CATEGORIES = new Set(['all', 'property', 'car', 'machinery', 'service']);

export default function Tours() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const requestedCategory = params.get('category') || 'all';
  const category = VALID_CATEGORIES.has(requestedCategory) ? requestedCategory : 'all';
  const [autoplay, setAutoplay] = useState(() => readStoredString('local', AUTOPLAY_KEY, 'on') !== 'off');
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
  const savedSet = useMemo(() => new Set(favourites.data || []), [favourites.data]);

  useEffect(() => {
    if (!activeTourId && items[0]?.tourId) setActiveTourId(items[0].tourId);
  }, [activeTourId, items]);

  useEffect(() => {
    const index = items.findIndex((item) => item.tourId === activeTourId);
    if (index < items.length - 2 || !feed.hasNextPage || feed.isFetchingNextPage) return;
    feed.fetchNextPage();
  }, [activeTourId, feed, items]);

  const updateAutoplay = (enabled) => {
    setAutoplay(enabled);
    writeStoredString('local', AUTOPLAY_KEY, enabled ? 'on' : 'off');
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
        <button type="button" onClick={() => navigate(-1)} className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 backdrop-blur-xl" aria-label="Go back"><ArrowLeft className="h-5 w-5" /></button>
        <div className="pointer-events-auto flex items-center gap-2">
          <button type="button" onClick={() => updateAutoplay(!autoplay)} className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 text-xs font-bold backdrop-blur-xl" aria-pressed={autoplay}><span>Autoplay</span><span className={autoplay ? 'text-blue-400' : 'text-white/55'}>{autoplay ? 'On' : 'Off'}</span></button>
          <button type="button" onClick={() => setSettingsOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 backdrop-blur-xl" aria-label="Peek settings"><Settings2 className="h-5 w-5" /></button>
        </div>
      </div>

      <nav className="absolute left-1/2 top-[max(4.4rem,calc(env(safe-area-inset-top)+3.6rem))] z-40 flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-black/35 p-1 backdrop-blur-xl" aria-label="Peek categories">
        {[
          ['all', 'For you'], ['property', 'Property'], ['car', 'Cars'], ['machinery', 'Machinery'], ['service', 'Services'],
        ].map(([value, label]) => <button key={value} type="button" onClick={() => changeCategory(value)} className={`min-h-9 rounded-full px-3 text-[11px] font-bold ${category === value ? 'bg-white text-black' : 'text-white/70'}`}>{label}</button>)}
      </nav>

      {feed.isLoading ? (
        <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>
      ) : feed.isError ? (
        <div className="flex h-full items-center justify-center px-5"><section className="max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center"><WifiOff className="mx-auto h-7 w-7 text-blue-400" /><h1 className="mt-3 text-lg font-bold">Peeks are temporarily offline</h1><p className="mt-2 text-sm text-white/65">Check your connection and try again.</p><Button variant="secondary" className="mt-4" onClick={() => feed.refetch()}><RefreshCw className="h-4 w-4" />Try again</Button></section></div>
      ) : items.length === 0 ? (
        <div className="flex h-full items-center justify-center px-5 text-center"><div><h1 className="text-xl font-bold">No Peeks here yet</h1><p className="mt-2 text-sm text-white/60">Try another category.</p></div></div>
      ) : (
        <main ref={feedRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth" aria-label="Full-screen Peeks feed">
          {items.map((item, index) => (
            <ImmersivePeekCard
              key={item.tourId}
              item={item}
              index={index}
              total={items.length + (feed.hasNextPage ? 1 : 0)}
              active={activeTourId === item.tourId}
              autoplay={autoplay}
              onVisible={setActiveTourId}
              isSaved={savedOverrides[item.parentId] ?? savedSet.has(item.parentId)}
              onSavedChange={(id, saved) => setSavedOverrides((current) => ({ ...current, [id]: saved }))}
            />
          ))}
          {feed.isFetchingNextPage && <div className="flex h-20 snap-start items-center justify-center bg-black"><Loader2 className="h-5 w-5 animate-spin text-blue-400" /></div>}
        </main>
      )}

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-xl rounded-t-[1.75rem] bg-slate-950 text-white">
          <SheetHeader className="text-left"><SheetTitle className="text-white">Peeks settings</SheetTitle><SheetDescription>Control how videos play while you browse.</SheetDescription></SheetHeader>
          <div className="mt-5 space-y-3">
            <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"><span><span className="block text-sm font-bold">Autoplay</span><span className="mt-1 block text-xs text-white/55">Play the visible Peek automatically.</span></span><Switch checked={autoplay} onCheckedChange={updateAutoplay} /></label>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-white/60">Only the active Peek plays. Videos pause when you swipe away or leave the page.</div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
