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

const actionClass = 'group flex min-h-12 w-full min-w-0 items-center gap-2 px-0.5 py-2 text-left text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-60';
const actionIconClass = 'flex h-8 w-8 shrink-0 items-center justify-center text-primary transition-transform group-hover:scale-105';
const actionLabelClass = 'min-w-0 whitespace-nowrap';

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
      toast.error('This Peek is temporarily unavailable');
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
      setGuestAction('report this Peek');
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
    <article data-tour-id={item.tourId} className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="relative aspect-square overflow-hidden bg-surface-secondary sm:aspect-video">
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
          <button type="button" onClick={loadPlayback} className="group relative block h-full w-full text-left" aria-label={`Play Peek for ${item.title}`} disabled={loadingPlayback}>
            {item.thumbnailUrl || item.coverImageUrl ? (
              <img src={item.thumbnailUrl || item.coverImageUrl} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
            ) : (
              <div className="h-full w-full bg-surface-raised" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/20" aria-hidden="true" />
            <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white shadow-xl backdrop-blur-md transition-transform group-hover:scale-105">
              {loadingPlayback ? <RotateCcw className="h-6 w-6 animate-spin" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
            </span>
          </button>
        )}

        {!showingPlayback && (
          <>
            <span className="absolute right-3 top-3 z-20 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
              {formatDuration(item.durationSeconds)}
            </span>
            <Link
              to={detailPath}
              className="absolute bottom-5 right-3 z-20 inline-flex h-11 items-center justify-center rounded-xl border border-white/30 bg-black/75 px-4 text-sm font-semibold text-white shadow-xl backdrop-blur-md transition-colors hover:bg-black/90 sm:bottom-4 sm:right-4"
            >
              View listing <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </>
        )}

        {playbackError && (
          <div className="absolute inset-x-3 bottom-3 z-30 rounded-xl border border-white/15 bg-black/80 p-3 text-white backdrop-blur-md">
            <p className="text-sm font-semibold">Peek playback failed</p>
            <button type="button" onClick={loadPlayback} className="mt-1 min-h-11 text-xs font-semibold text-blue-200 hover:text-white">Try again</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_7.25rem] gap-2.5 border-t border-border bg-card p-4 text-card-foreground sm:grid-cols-[minmax(0,1fr)_7.5rem] sm:gap-3 sm:p-5">
        <div className="min-w-0 py-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-sm font-bold text-foreground">{item.sellerDisplayName}</p>
            {!isOwner && (
              <button
                type="button"
                onClick={openReport}
                aria-label="Report Peek"
                title="Report Peek"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <Flag className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Link to={detailPath} className="mt-3 block line-clamp-2 text-lg font-black leading-6 text-foreground transition-colors hover:text-primary sm:text-xl">
            {item.title}
          </Link>

          {item.publicLocation && (
            <p className="mt-2 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.publicLocation}</span>
            </p>
          )}

          <p className="mt-4 truncate text-xl font-black text-primary sm:text-2xl">{priceLabel(item, format)}</p>
        </div>

        <div className="flex min-w-0 flex-col justify-center divide-y divide-border border-l border-border pl-2.5">
          {listingOnly && (
            <button type="button" onClick={toggleSave} aria-label={liked ? 'Remove from saved' : 'Save listing'} aria-pressed={liked} disabled={saving} className={cn(actionClass, liked && 'text-destructive')}>
              <span className={cn(actionIconClass, liked && 'text-destructive')}><Heart className={cn('h-5 w-5', liked && 'fill-current')} /></span>
              <span className={actionLabelClass}>{liked ? 'Saved' : 'Save'}</span>
            </button>
          )}
          {canMessage ? (
            <button type="button" onClick={openChat} aria-label="Message seller" className={actionClass}>
              <span className={actionIconClass}><MessageCircle className="h-5 w-5" /></span>
              <span className={actionLabelClass}>Message</span>
            </button>
          ) : !isOwner ? (
            <Link to={publicTourDetailPath(item, { openTour: false })} aria-label="Contact provider" className={actionClass}>
              <span className={actionIconClass}><MessageCircle className="h-5 w-5" /></span>
              <span className={actionLabelClass}>Contact</span>
            </Link>
          ) : null}
          <button type="button" onClick={share} aria-label="Share listing" className={actionClass}>
            <span className={actionIconClass}><Share2 className="h-5 w-5" /></span>
            <span className={actionLabelClass}>Share</span>
          </button>
        </div>
      </div>

      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action={guestAction} returnTo={detailPath} />
      {canMessage && <MessageDialog open={messageOpen} onClose={() => setMessageOpen(false)} listing={messageListing} type={item.listingType} />}
      {!isOwner && <TourReportDialog open={reportOpen} onOpenChange={setReportOpen} tourId={item.tourId} title={item.title} onReported={onReported} />}
    </article>
  );
}
