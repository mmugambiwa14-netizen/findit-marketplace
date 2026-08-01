import { readStoredString, removeStoredValue, writeStoredString } from '@/lib/browserStorage';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Flag, Heart, MapPin, MessageCircle, Play, RotateCcw, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import MessageDialog from '@/components/listings/MessageDialog';
import TourReportDialog from '@/components/tours/TourReportDialog';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/CurrencyContext';
import { addFavourite, removeFavourite } from '@/services/favouritesService';
import { getPublicTourPlayback, publicTourDetailPath } from '@/services/listingToursService';

function formatDuration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function playbackKey(tourId) {
  return `findit:tour-playback:${tourId}`;
}

function priceLabel(item, format) {
  if (item.parentType === 'service' && (item.pricingType === 'quote' || item.price == null)) return 'Contact for quote';
  if (item.price == null) return 'Price on request';
  const prefix = item.parentType === 'service' && item.pricingType === 'starting_from' ? 'From ' : '';
  const suffix = item.parentType === 'service' && item.pricingType === 'hourly' ? '/hr' : '';
  return `${prefix}${format(item.price)}${suffix}`;
}

function categoryLabel(item) {
  if (item.parentType === 'service') return 'Services';
  if (item.category === 'car' || item.parentCategory === 'car') return 'Cars';
  if (item.category === 'machinery' || item.parentCategory === 'machinery') return 'Machinery';
  return 'Property';
}

const actionClass = 'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-semibold text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60';

export default function TourCard({ item, active, onActivate, isSaved = false, onSavedChange, onReported }) {
  const { user } = useAuth();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const videoRef = useRef(null);
  const [playback, setPlayback] = useState(null);
  const [loadingPlayback, setLoadingPlayback] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [liked, setLiked] = useState(isSaved);
  const [saving, setSaving] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestAction, setGuestAction] = useState('continue');
  const [messageOpen, setMessageOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const detailPath = publicTourDetailPath(item);
  const listingOnly = item.parentType === 'listing';
  const isOwner = Boolean(user?.id && user.id === item.sellerId);
  const canMessage = listingOnly && featureFlags.messaging && !isOwner;
  const showingPlayback = Boolean(active && playback?.playbackUrl && !playbackError);

  useEffect(() => setLiked(isSaved), [isSaved]);
  useEffect(() => {
    if (!active && videoRef.current) videoRef.current.pause();
  }, [active]);

  const loadPlayback = async () => {
    onActivate(item.tourId);
    setPlaybackError(false);
    const expiresAt = Number(playback?.expiresAt || 0);
    if (playback && expiresAt > Date.now() + 10_000) {
      queueMicrotask(() => videoRef.current?.play().catch(() => {}));
      return;
    }
    setPlayback(null);
    setLoadingPlayback(true);
    try {
      const result = await getPublicTourPlayback(item.parentType, item.parentId);
      if (!result?.playbackUrl) throw new Error('Playback unavailable');
      setPlayback({
        ...result,
        expiresAt: Date.now() + Math.max(1, Number(result.expiresInSeconds) || 1) * 1000,
      });
    } catch {
      setPlaybackError(true);
      toast.error('This Tour is temporarily unavailable');
    } finally {
      setLoadingPlayback(false);
    }
  };

  const restorePlaybackPosition = () => {
    const saved = Number(readStoredString('session', playbackKey(item.tourId), '0') || 0);
    if (videoRef.current && Number.isFinite(saved) && saved > 0 && saved < videoRef.current.duration - 2) {
      videoRef.current.currentTime = saved;
    }
    videoRef.current?.play().catch(() => {});
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
      if (liked) await removeFavourite(user.id, item.parentId);
      else await addFavourite(user.id, item.parentId);
      const next = !liked;
      setLiked(next);
      onSavedChange?.(item.parentId, next);
      queryClient.invalidateQueries({ queryKey: ['favourite-listings', user.id] });
      toast.success(next ? 'Added to saved' : 'Removed from saved');
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

  const openChat = () => {
    if (!user) {
      setGuestAction('message this seller');
      setGuestOpen(true);
      return;
    }
    setMessageOpen(true);
  };

  const openReport = () => {
    if (!user) {
      setGuestAction('report this Tour');
      setGuestOpen(true);
      return;
    }
    setReportOpen(true);
  };

  const messageListing = {
    id: item.parentId,
    title: item.title,
    seller_id: item.sellerId,
    price: item.price,
    status: item.availability,
  };

  return (
    <article data-tour-id={item.tourId} className="clay-card overflow-hidden rounded-2xl">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-secondary sm:aspect-video">
        {showingPlayback ? (
          <video
            ref={videoRef}
            src={playback.playbackUrl}
            poster={item.thumbnailUrl || item.coverImageUrl || undefined}
            controls
            playsInline
            muted
            autoPlay
            preload={navigator['connection']?.saveData ? 'none' : 'metadata'}
            className="h-full w-full object-cover"
            onLoadedMetadata={restorePlaybackPosition}
            onTimeUpdate={(event) => writeStoredString('session', playbackKey(item.tourId), event.currentTarget.currentTime)}
            onEnded={() => {
              removeStoredValue('session', playbackKey(item.tourId));
              onActivate(null);
            }}
            onError={() => { setPlayback(null); setPlaybackError(true); }}
          />
        ) : (
          <button type="button" onClick={loadPlayback} className="group relative block h-full w-full text-left" aria-label={`Play Tour for ${item.title}`} disabled={loadingPlayback}>
            {item.thumbnailUrl || item.coverImageUrl ? (
              <img src={item.thumbnailUrl || item.coverImageUrl} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
            ) : (
              <div className="h-full w-full bg-surface-raised" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/25" aria-hidden="true" />
            <span className="absolute left-1/2 top-[43%] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/92 text-slate-900 shadow-xl transition-transform group-hover:scale-105">
              {loadingPlayback ? <RotateCcw className="h-5 w-5 animate-spin" /> : <Play className="ml-1 h-6 w-6 fill-current" />}
            </span>
          </button>
        )}

        {!showingPlayback && (
          <>
            <span className="absolute left-3 top-3 z-20 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
              {categoryLabel(item)}
            </span>
            <span className="absolute right-3 top-3 z-20 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
              {formatDuration(item.durationSeconds)}
            </span>
            {listingOnly && (
              <button
                type="button"
                onClick={toggleSave}
                aria-label={liked ? 'Remove from saved' : 'Save listing'}
                aria-pressed={liked}
                disabled={saving}
                className={cn('absolute bottom-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur-md', liked && 'text-red-400')}
              >
                <Heart className={cn('h-5 w-5', liked && 'fill-current')} />
              </button>
            )}
            <Link to={detailPath} className="absolute inset-x-0 bottom-0 z-10 block px-3 pb-3 pr-14 text-white" aria-label={`View listing ${item.title}`}>
              <p className="line-clamp-1 text-base font-extrabold leading-5">{item.title}</p>
              <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
                {item.publicLocation ? (
                  <p className="flex min-w-0 items-center gap-1 text-[11px] text-white/75">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{item.publicLocation}</span>
                  </p>
                ) : <span />}
                <p className="shrink-0 text-xs font-bold text-blue-300">{priceLabel(item, format)}</p>
              </div>
            </Link>
          </>
        )}

        {playbackError && (
          <div className="absolute inset-x-3 bottom-3 z-30 rounded-xl border border-white/15 bg-black/80 p-3 text-white backdrop-blur-md">
            <p className="text-sm font-semibold">Tour playback failed</p>
            <button type="button" onClick={loadPlayback} className="mt-1 min-h-11 text-xs font-semibold text-blue-200 hover:text-white">Try again</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1 border-t border-border bg-card/80 p-2">
        <Link to={detailPath} className={actionClass} aria-label="View listing">
          <ArrowUpRight className="h-4 w-4 text-primary" />
          <span>Listing</span>
        </Link>
        {canMessage ? (
          <button type="button" onClick={openChat} className={actionClass} aria-label="Message seller">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span>Chat</span>
          </button>
        ) : !isOwner ? (
          <Link to={publicTourDetailPath(item, { openTour: false })} className={actionClass} aria-label="Contact provider">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span>Contact</span>
          </Link>
        ) : <span />}
        <button type="button" onClick={share} className={actionClass} aria-label="Share listing">
          <Share2 className="h-4 w-4 text-primary" />
          <span>Share</span>
        </button>
        {!isOwner ? (
          <button type="button" onClick={openReport} className={actionClass} aria-label="Report Tour">
            <Flag className="h-4 w-4 text-primary" />
            <span>Report</span>
          </button>
        ) : <span />}
      </div>

      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action={guestAction} returnTo={detailPath} />
      {canMessage && <MessageDialog open={messageOpen} onClose={() => setMessageOpen(false)} listing={messageListing} type={item.listingType} />}
      {!isOwner && <TourReportDialog open={reportOpen} onOpenChange={setReportOpen} tourId={item.tourId} title={item.title} onReported={onReported} />}
    </article>
  );
}
