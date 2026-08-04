import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  ChevronUp,
  Flag,
  MapPin,
  Play,
  RotateCcw,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import TourReportDialog from '@/components/tours/TourReportDialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useCurrency } from '@/lib/CurrencyContext';
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

function availabilityLabel(value) {
  const labels = {
    available: 'Available',
    under_offer: 'Under offer',
    active: 'Available',
    paused: 'Paused',
    unavailable: 'Unavailable',
    sold: 'Sold',
    rented: 'Rented',
  };
  return labels[value] || null;
}

export default function ImmersivePeekSlide({
  item,
  active,
  nearby,
  autoplay,
  muteByDefault,
  index,
  total,
  isSaved,
  onSavedChange,
  onVisible,
  onEnded,
}) {
  const { user } = useAuth();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const loadPromiseRef = useRef(null);
  const [playback, setPlayback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(muteByDefault);
  const [progress, setProgress] = useState(0);
  const [saved, setSaved] = useState(isSaved);
  const [saving, setSaving] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestAction, setGuestAction] = useState('continue');
  const [reportOpen, setReportOpen] = useState(false);

  const detailPath = publicTourDetailPath(item);
  const listingOnly = item.parentType === 'listing';
  const isOwner = Boolean(user?.id && user.id === item.sellerId);
  const poster = item.thumbnailUrl || item.coverImageUrl || undefined;
  const availability = availabilityLabel(item.availability);
  const requestPath = `${detailPath}${detailPath.includes('?') ? '&' : '?'}requestPeek=1`;

  useEffect(() => setSaved(isSaved), [isSaved]);
  useEffect(() => setMuted(muteByDefault), [muteByDefault]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.72) onVisible(item.tourId);
    }, { threshold: [0.4, 0.72, 0.9] });
    observer.observe(node);
    return () => observer.disconnect();
  }, [item.tourId, onVisible]);

  const loadPlayback = async () => {
    if (playback?.playbackUrl) return playback;
    if (loadPromiseRef.current) return loadPromiseRef.current;
    setLoading(true);
    setFailed(false);
    loadPromiseRef.current = getPublicTourPlayback(item.parentType, item.parentId)
      .then((result) => {
        if (!result?.playbackUrl) throw new Error('unavailable');
        setPlayback(result);
        return result;
      })
      .catch(() => {
        setFailed(true);
        return null;
      })
      .finally(() => {
        setLoading(false);
        loadPromiseRef.current = null;
      });
    return loadPromiseRef.current;
  };

  useEffect(() => {
    if (!nearby) {
      videoRef.current?.pause();
      setPlaying(false);
      setProgress(0);
      const timer = window.setTimeout(() => setPlayback(null), 500);
      return () => window.clearTimeout(timer);
    }
    if (!active) {
      videoRef.current?.pause();
      setPlaying(false);
      return undefined;
    }
    if (!autoplay) return undefined;

    let cancelled = false;
    loadPlayback().then((result) => {
      if (cancelled || !result) return;
      requestAnimationFrame(() => videoRef.current?.play().catch(() => {}));
    });
    return () => { cancelled = true; };
  }, [active, autoplay, nearby]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        videoRef.current?.pause();
        setPlaying(false);
      } else if (active && autoplay) {
        videoRef.current?.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
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
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Listing link copied');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('Could not share this listing');
    }
  };

  const openReport = () => {
    if (!user) {
      setGuestAction('report this listing');
      setGuestOpen(true);
      return;
    }
    setReportOpen(true);
  };

  return (
    <article
      ref={rootRef}
      data-tour-id={item.tourId}
      aria-label={`${peekLabel(item)} for ${item.title}`}
      className="relative h-full min-h-[36rem] snap-start snap-always overflow-hidden bg-black text-white"
    >
      {playback?.playbackUrl ? (
        <video
          ref={videoRef}
          src={playback.playbackUrl}
          poster={poster}
          playsInline
          muted={muted}
          preload={nearby ? 'metadata' : 'none'}
          className="absolute inset-0 h-full w-full object-cover"
          onClick={togglePlayback}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => {
            const duration = event.currentTarget.duration || 0;
            setProgress(duration > 0 ? event.currentTarget.currentTime / duration : 0);
          }}
          onEnded={() => {
            setPlaying(false);
            setProgress(1);
            onEnded?.(item.tourId);
          }}
          onError={() => {
            setFailed(true);
            setPlayback(null);
          }}
        />
      ) : poster ? (
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" loading={nearby ? 'eager' : 'lazy'} decoding="async" />
      ) : <div className="absolute inset-0 bg-slate-950" />}

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/0 to-black/95" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-1 bg-white/15" aria-hidden="true">
        <div className="h-full bg-blue-400 transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
      </div>

      {!playing && (
        <button type="button" onClick={togglePlayback} disabled={loading} className="absolute left-1/2 top-[43%] z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 shadow-2xl backdrop-blur-lg active:scale-95" aria-label="Play Peek">
          {loading ? <RotateCcw className="h-6 w-6 animate-spin" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
        </button>
      )}

      {playing && <button type="button" onClick={togglePlayback} className="absolute inset-0 z-[1] cursor-default" aria-label="Pause Peek"><span className="sr-only">Pause Peek</span></button>}

      {failed && (
        <div className="absolute left-4 right-4 top-[38%] z-20 rounded-2xl border border-white/15 bg-black/80 p-4 text-center backdrop-blur-xl">
          <p className="font-bold">This Peek is temporarily unavailable</p>
          <p className="mt-1 text-xs text-white/60">Your place in the feed is safe.</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={togglePlayback}>Try again</Button>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-5">
        <div className="mb-3 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/85 backdrop-blur-md">{item.parentType === 'service' ? 'Service' : item.parentCategory || item.category || 'Listing'}</span>
              {availability && <span className="rounded-full bg-emerald-500/90 px-2.5 py-1 text-[10px] font-bold text-white">{availability}</span>}
              <span className="text-[11px] text-white/60">{index + 1} of {total}</span>
            </div>
            <h2 className="line-clamp-2 text-xl font-black leading-tight">{item.title}</h2>
            <p className="mt-1 text-lg font-extrabold text-blue-400">{priceLabel(item, format)}</p>
            {item.publicLocation && <p className="mt-1 flex items-center gap-1.5 text-sm text-white/75"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{item.publicLocation}</span></p>}
            {item.peekKind === 'response' && item.requestText && <p className="mt-2 line-clamp-2 rounded-xl border border-blue-400/25 bg-blue-500/15 px-3 py-2 text-xs text-white/90 backdrop-blur-md">Answers: “{item.requestText}”</p>}
          </div>
          <button type="button" onClick={() => setMuted((value) => !value)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/45 backdrop-blur-md" aria-label={muted ? 'Turn sound on' : 'Mute'}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>

        <div className="mb-2 flex justify-end gap-2">
          <button type="button" onClick={share} className="flex min-h-12 min-w-16 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/55 px-3 text-[10px] font-semibold text-white/85 backdrop-blur-xl" aria-label="Share listing"><Share2 className="mb-1 h-5 w-5" />Share</button>
          {listingOnly && <button type="button" onClick={toggleSave} disabled={saving} className={cn('flex min-h-12 min-w-16 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/55 px-3 text-[10px] font-semibold text-white/85 backdrop-blur-xl', saved && 'border-blue-400/40 text-blue-300')} aria-label={saved ? 'Remove from saved' : 'Save listing'}><Bookmark className={cn('mb-1 h-5 w-5', saved && 'fill-current')} />{saved ? 'Saved' : 'Save'}</button>}
          {!isOwner && <button type="button" onClick={openReport} className="flex min-h-12 min-w-16 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/55 px-3 text-[10px] font-semibold text-white/85 backdrop-blur-xl" aria-label="Report listing"><Flag className="mb-1 h-5 w-5" />Report</button>}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/55 p-2 backdrop-blur-xl">
          <Link to={detailPath} className="flex min-h-12 items-center justify-center rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground">View listing</Link>
          {!isOwner && listingOnly ? <Link to={requestPath} className="flex min-h-12 items-center justify-center rounded-xl border border-blue-400/35 bg-slate-950/70 px-3 text-sm font-bold text-white">Request a Peek</Link> : <Link to={detailPath} className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white/85">More details</Link>}
        </div>

        <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50"><ChevronUp className="h-3.5 w-3.5" />Swipe for the next Peek</p>
      </div>

      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action={guestAction} returnTo={detailPath} />
      {!isOwner && <TourReportDialog open={reportOpen} onOpenChange={setReportOpen} tourId={item.tourId} title={item.title} />}
    </article>
  );
}
