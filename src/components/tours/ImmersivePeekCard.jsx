import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bookmark, Flag, MapPin, MessageCircle, Pause, Play, RotateCcw, Share2, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import MessageDialog from '@/components/listings/MessageDialog';
import TourReportDialog from '@/components/tours/TourReportDialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { featureFlags } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';
import { addFavourite, removeFavourite } from '@/services/favouritesService';
import { getPublicTourPlayback, publicTourDetailPath } from '@/services/listingToursService';

function priceLabel(item, format) {
  if (item.parentType === 'service' && (item.pricingType === 'quote' || item.price == null)) return 'Contact for quote';
  if (item.price == null) return 'Price on request';
  const prefix = item.parentType === 'service' && item.pricingType === 'starting_from' ? 'From ' : '';
  const suffix = item.parentType === 'service' && item.pricingType === 'hourly' ? '/hr' : '';
  return `${prefix}${format(item.price)}${suffix}`;
}

function peekLabel(item) {
  if (item.peekKind === 'response') return 'Response Peek';
  if (item.parentType === 'service') return 'Service Peek';
  return 'Listing Peek';
}

export default function ImmersivePeekCard({ item, active, autoplay, index, total, isSaved, onSavedChange, onVisible }) {
  const { user } = useAuth();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const [playback, setPlayback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [saved, setSaved] = useState(isSaved);
  const [saving, setSaving] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestAction, setGuestAction] = useState('continue');
  const [messageOpen, setMessageOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const detailPath = publicTourDetailPath(item);
  const listingOnly = item.parentType === 'listing';
  const isOwner = Boolean(user?.id && user.id === item.sellerId);
  const canMessage = listingOnly && featureFlags.messaging && !isOwner;

  useEffect(() => setSaved(isSaved), [isSaved]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.7) onVisible(item.tourId);
    }, { threshold: [0.7] });
    observer.observe(node);
    return () => observer.disconnect();
  }, [item.tourId, onVisible]);

  const loadPlayback = async () => {
    if (loading || playback?.playbackUrl) return playback;
    setLoading(true);
    setFailed(false);
    try {
      const result = await getPublicTourPlayback(item.parentType, item.parentId);
      if (!result?.playbackUrl) throw new Error('unavailable');
      setPlayback(result);
      return result;
    } catch {
      setFailed(true);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!active) {
      videoRef.current?.pause();
      setPlaying(false);
      return undefined;
    }
    if (!autoplay) return undefined;
    loadPlayback().then((result) => {
      if (cancelled || !result) return;
      requestAnimationFrame(() => videoRef.current?.play().catch(() => {}));
    });
    return () => { cancelled = true; };
  }, [active, autoplay]);

  const togglePlayback = async () => {
    const result = await loadPlayback();
    if (!result || !videoRef.current) return;
    if (videoRef.current.paused) videoRef.current.play().catch(() => {});
    else videoRef.current.pause();
  };

  const toggleSave = async () => {
    if (!listingOnly || saving) return;
    if (!user) {
      setGuestAction('save this listing');
      setGuestOpen(true);
      return;
    }
    setSaving(true);
    try {
      if (saved) await removeFavourite(user.id, item.parentId);
      else await addFavourite(user.id, item.parentId);
      const next = !saved;
      setSaved(next);
      onSavedChange?.(item.parentId, next);
      queryClient.invalidateQueries({ queryKey: ['favourite-listings', user.id] });
      toast.success(next ? 'Saved' : 'Removed from saved');
    } catch {
      toast.error('Could not update saved listings');
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
    const url = new URL(detailPath.replace(/^\//, ''), base).toString();
    try {
      if (navigator.share) await navigator.share({ title: item.title, url });
      else { await navigator.clipboard.writeText(url); toast.success('Listing link copied'); }
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('Could not share this listing');
    }
  };

  const openChat = () => {
    if (!user) { setGuestAction('message this seller'); setGuestOpen(true); return; }
    setMessageOpen(true);
  };

  const openReport = () => {
    if (!user) { setGuestAction('report this Peek'); setGuestOpen(true); return; }
    setReportOpen(true);
  };

  const messageListing = { id: item.parentId, title: item.title, seller_id: item.sellerId, price: item.price, status: item.availability };
  const poster = item.thumbnailUrl || item.coverImageUrl || undefined;

  return (
    <article ref={rootRef} data-tour-id={item.tourId} className="relative h-[calc(100dvh-var(--findit-mobile-nav-height,5.25rem))] min-h-[36rem] snap-start snap-always overflow-hidden bg-black text-white sm:h-[calc(100dvh-4.5rem)]">
      {playback?.playbackUrl ? (
        <video
          ref={videoRef}
          src={playback.playbackUrl}
          poster={poster}
          playsInline
          muted={muted}
          preload={active ? 'auto' : 'metadata'}
          className="absolute inset-0 h-full w-full object-cover"
          onClick={togglePlayback}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => { setFailed(true); setPlayback(null); }}
        />
      ) : poster ? (
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" loading={index < 2 ? 'eager' : 'lazy'} />
      ) : <div className="absolute inset-0 bg-slate-950" />}

      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/5 to-black/90" aria-hidden="true" />

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-sm font-black tracking-tight">Peeks</p>
          <p className="text-[11px] text-white/70">{index + 1} of {total}</p>
        </div>
        <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] backdrop-blur-md">{peekLabel(item)}</span>
      </div>

      {!playing && (
        <button type="button" onClick={togglePlayback} disabled={loading} className="absolute left-1/2 top-[43%] z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 backdrop-blur-lg" aria-label="Play Peek">
          {loading ? <RotateCcw className="h-6 w-6 animate-spin" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
        </button>
      )}

      {failed && (
        <div className="absolute left-4 right-4 top-[40%] z-20 rounded-2xl border border-white/15 bg-black/75 p-4 text-center backdrop-blur-xl">
          <p className="font-bold">This Peek is temporarily unavailable</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={togglePlayback}>Try again</Button>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-4 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-black leading-tight">{item.title}</p>
            <p className="mt-1 text-lg font-extrabold text-blue-400">{priceLabel(item, format)}</p>
            {item.publicLocation && <p className="mt-1 flex items-center gap-1.5 text-sm text-white/75"><MapPin className="h-4 w-4" /><span className="truncate">{item.publicLocation}</span></p>}
            {item.peekKind === 'response' && item.requestText && <p className="mt-2 line-clamp-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/80">Answers: “{item.requestText}”</p>}
          </div>
          <button type="button" onClick={() => setMuted((value) => !value)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/35 backdrop-blur-md" aria-label={muted ? 'Turn sound on' : 'Mute'}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2 rounded-2xl border border-white/10 bg-black/45 p-2 backdrop-blur-xl">
          <Link to={detailPath} className="col-span-2 flex min-h-11 items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground">View listing</Link>
          {listingOnly ? <button type="button" onClick={toggleSave} disabled={saving} className={cn('flex min-h-11 items-center justify-center rounded-xl text-white/80', saved && 'text-blue-400')} aria-label={saved ? 'Remove from saved' : 'Save listing'}><Bookmark className={cn('h-5 w-5', saved && 'fill-current')} /></button> : <span />}
          {canMessage ? <button type="button" onClick={openChat} className="flex min-h-11 items-center justify-center rounded-xl text-white/80" aria-label="Chat with seller"><MessageCircle className="h-5 w-5" /></button> : <Link to={detailPath} className="flex min-h-11 items-center justify-center rounded-xl text-white/80" aria-label="Contact provider"><MessageCircle className="h-5 w-5" /></Link>}
          <div className="flex items-center justify-evenly">
            <button type="button" onClick={share} className="p-2 text-white/80" aria-label="Share"><Share2 className="h-5 w-5" /></button>
            {!isOwner && <button type="button" onClick={openReport} className="p-2 text-white/80" aria-label="Report"><Flag className="h-5 w-5" /></button>}
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55">Swipe up for the next Peek</p>
      </div>

      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action={guestAction} returnTo={detailPath} />
      {canMessage && <MessageDialog open={messageOpen} onClose={() => setMessageOpen(false)} listing={messageListing} type={item.listingType} />}
      {!isOwner && <TourReportDialog open={reportOpen} onOpenChange={setReportOpen} tourId={item.tourId} title={item.title} />}
    </article>
  );
}
