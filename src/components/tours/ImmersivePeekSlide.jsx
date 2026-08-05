import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  Clock3,
  Eye,
  Flag,
  MapPin,
  Play,
  RotateCcw,
  Share2,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import TourReportDialog from '@/components/tours/TourReportDialog';
import { Button } from '@/components/ui/button';
import { useImmediatePeekView } from '@/hooks/useImmediatePeekView';
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
  return labels[value] || 'Available';
}

function relativeTime(value) {
  if (!value) return 'Recently';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Recently';
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function initialViewCount(item) {
  const value = Number(item.viewCount ?? item.views ?? item.playCount ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatPlaybackTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function ImmersivePeekSlide({
  item,
  active,
  nearby,
  autoplay,
  muteByDefault,
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [saved, setSaved] = useState(isSaved);
  const [saving, setSaving] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestAction, setGuestAction] = useState('continue');
  const [reportOpen, setReportOpen] = useState(false);

  const detailPath = publicTourDetailPath(item);
  const listingOnly = item.parentType === 'listing';
  const isOwner = Boolean(user?.id && user.id === item.sellerId);
  const poster = item.thumbnailUrl || item.coverImageUrl || undefined;
  const requestPath = `${detailPath}${detailPath.includes('?') ? '&' : '?'}requestPeek=1`;
  const postedAt = item.publishedAt || item.capturedAt || item.createdAt;
  const { viewCount, recordView } = useImmediatePeekView({
    tourId: item.tourId,
    initialCount: initialViewCount(item),
    enabled: !isOwner,
  });

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
      setCurrentTime(0);
      setDuration(0);
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

  const seek = async (event) => {
    const result = await loadPlayback();
    const video = videoRef.current;
    if (!result || !video) return;
    const nextTime = Number(event.target.value);
    if (!Number.isFinite(nextTime)) return;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
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

  const actionClass = 'flex h-11 w-11 flex-col items-center justify-center rounded-full bg-transparent text-[9px] font-semibold text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.95)] hover:bg-white/10';

  return (
    <article
      ref={rootRef}
      data-tour-id={item.tourId}
      aria-label={`Peek for ${item.title}`}
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
          onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onPlay={() => {
            setPlaying(true);
            recordView();
          }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
          onEnded={() => {
            setPlaying(false);
            setCurrentTime(duration);
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

      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/0 to-black/95" aria-hidden="true" />

      {!playing && (
        <button type="button" onClick={togglePlayback} disabled={loading} className="absolute left-1/2 top-[43%] z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/35 shadow-2xl backdrop-blur-sm active:scale-95" aria-label="Play Peek">
          {loading ? <RotateCcw className="h-5 w-5 animate-spin" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}
        </button>
      )}

      {playing && <button type="button" onClick={togglePlayback} className="absolute inset-0 z-[1] cursor-default" aria-label="Pause Peek"><span className="sr-only">Pause Peek</span></button>}

      {failed && (
        <div className="absolute left-4 right-4 top-[38%] z-20 rounded-[var(--findit-panel-radius)] border border-white/15 bg-black/80 p-4 text-center backdrop-blur-xl">
          <p className="font-bold">This Peek is temporarily unavailable</p>
          <p className="mt-1 text-xs text-white/60">Your place in the feed is safe.</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={togglePlayback}>Try again</Button>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 px-[var(--findit-page-gutter)] pb-[calc(var(--findit-nav-height)+1.1rem+env(safe-area-inset-bottom))] sm:pb-5">
        <div className="relative pr-[3.8rem]">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/90 backdrop-blur-sm">
              {item.parentType === 'service' ? 'Service' : item.parentCategory || item.category || 'Listing'}
            </span>
          </div>
          <h2 className="line-clamp-2 text-xl font-black leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{item.title}</h2>
          <p className="mt-1 text-lg font-extrabold text-blue-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">{priceLabel(item, format)}</p>
          {item.publicLocation && <p className="mt-1 flex items-center gap-1.5 text-sm text-white/90 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{item.publicLocation}</span></p>}
          {item.peekKind === 'response' && item.requestText && <p className="mt-2 line-clamp-2 max-w-xl rounded-xl border border-blue-400/25 bg-black/30 px-3 py-2 text-xs text-white/95 backdrop-blur-sm">Answers: “{item.requestText}”</p>}

          <div className="absolute bottom-0 right-0 flex flex-col gap-1.5">
            {listingOnly && (
              <button type="button" onClick={toggleSave} disabled={saving} className={cn(actionClass, saved && 'text-blue-300')} aria-label={saved ? 'Remove from saved' : 'Save listing'}>
                <Bookmark className={cn('mb-0.5 h-4 w-4', saved && 'fill-current')} />
                {saved ? 'Saved' : 'Save'}
              </button>
            )}
            <button type="button" onClick={share} className={actionClass} aria-label="Share listing">
              <Share2 className="mb-0.5 h-4 w-4" />Share
            </button>
            {!isOwner && (
              <button type="button" onClick={openReport} className={actionClass} aria-label="Report listing">
                <Flag className="mb-0.5 h-4 w-4" />Report
              </button>
            )}
            <button type="button" onClick={() => setMuted((value) => !value)} className={actionClass} aria-label={muted ? 'Turn sound on' : 'Mute'}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              <span className="sr-only">{muted ? 'Sound off' : 'Sound on'}</span>
            </button>
          </div>
        </div>

        <div className="mt-3">
          <input
            type="range"
            min="0"
            max={Math.max(duration, 0)}
            step="0.05"
            value={Math.min(currentTime, duration || 0)}
            onClick={(event) => event.stopPropagation()}
            onChange={seek}
            disabled={!duration}
            aria-label="Seek through Peek"
            className="h-5 w-full cursor-pointer appearance-none bg-transparent accent-blue-500 disabled:cursor-default disabled:opacity-55 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/35 [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-blue-500 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/35"
          />
          <div className="-mt-1 flex justify-between text-[10px] font-semibold tabular-nums text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            <span>{formatPlaybackTime(currentTime)}</span>
            <span>{formatPlaybackTime(duration)}</span>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link to={detailPath} className="flex h-[var(--findit-control-height-lg)] items-center justify-center rounded-[var(--findit-control-radius)] bg-primary px-3 text-sm font-bold text-primary-foreground">View listing</Link>
          {!isOwner && listingOnly ? (
            <Link to={requestPath} className="flex h-[var(--findit-control-height-lg)] items-center justify-center rounded-[var(--findit-control-radius)] border border-white/25 bg-black/25 px-3 text-sm font-bold text-white backdrop-blur-sm">Request a Peek</Link>
          ) : (
            <Link to={detailPath} className="flex h-[var(--findit-control-height-lg)] items-center justify-center rounded-[var(--findit-control-radius)] border border-white/20 bg-black/20 px-3 text-sm font-bold text-white/90 backdrop-blur-sm">More details</Link>
          )}
        </div>

        <div className="mt-2 grid grid-cols-3 divide-x divide-white/10 rounded-[var(--findit-panel-radius)] border border-white/10 bg-black/35 px-1 py-2 backdrop-blur-md">
          <div className="flex min-w-0 items-center justify-center gap-1.5 px-1.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <div className="min-w-0"><p className="truncate text-[11px] font-bold">{availabilityLabel(item.availability)}</p><p className="truncate text-[9px] text-white/55">Status</p></div>
          </div>
          <div className="flex min-w-0 items-center justify-center gap-1.5 px-1.5">
            <Eye className="h-4 w-4 shrink-0 text-white/70" />
            <div className="min-w-0"><p className="truncate text-[11px] font-bold">{viewCount.toLocaleString()}</p><p className="truncate text-[9px] text-white/55">Views</p></div>
          </div>
          <div className="flex min-w-0 items-center justify-center gap-1.5 px-1.5">
            <Clock3 className="h-4 w-4 shrink-0 text-white/70" />
            <div className="min-w-0"><p className="truncate text-[11px] font-bold">{relativeTime(postedAt)}</p><p className="truncate text-[9px] text-white/55">Fresh</p></div>
          </div>
        </div>
      </div>

      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action={guestAction} returnTo={detailPath} />
      {!isOwner && <TourReportDialog open={reportOpen} onOpenChange={setReportOpen} tourId={item.tourId} title={item.title} />}
    </article>
  );
}
