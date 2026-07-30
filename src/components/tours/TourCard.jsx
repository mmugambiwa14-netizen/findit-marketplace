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

function listingTypeLabel(item) {
  if (item.listingType === 'car') return 'Vehicle';
  if (item.listingType === 'machinery') return 'Equipment';
  if (item.listingType === 'service') return 'Service';
  return 'Property';
}

const overlayActionClass = 'inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-black/55 px-2.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-wait disabled:opacity-60';

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
  const actionCount = (listingOnly ? 1 : 0) + (canMessage || !isOwner ? 1 : 0) + 1;
  const actionGridClass = actionCount >= 3 ? 'grid-cols-3' : actionCount === 2 ? 'grid-cols-2' : 'grid-cols-1';

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
      <div className={cn(
        'relative overflow-hidden bg-surface-secondary',
        showingPlayback ? 'aspect-video' : 'aspect-[4/5] min-h-[32rem] sm:aspect-video sm:min-h-0',
      )}>
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/15 to-black/20" aria-hidden="true" />
            <span className="absolute left-1/2 top-[35%] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white shadow-xl backdrop-blur-md transition-transform group-hover:scale-105">
              {loadingPlayback ? <RotateCcw className="h-6 w-6 animate-spin" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
            </span>
          </button>
        )}

        {!showingPlayback && (
          <>
            <span className="absolute right-3 top-3 z-20 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
              {formatDuration(item.durationSeconds)}
            </span>

            <div className="absolute inset-x-0 bottom-0 z-10 p-4 text-white sm:p-5">
              <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-white/80">
                <span className="max-w-[58%] truncate">{item.sellerDisplayName}</span>
                <span className="shrink-0 rounded-full border border-white/15 bg-black/35 px-2 py-0.5 text-[10px] uppercase tracking-wide backdrop-blur-sm">{listingTypeLabel(item)}</span>
                {!isOwner && (
                  <button type="button" onClick={openReport} aria-label="Report Peek" className="ml-auto inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-1.5 text-[10px] text-white/65 hover:bg-white/10 hover:text-white">
                    <Flag className="h-3 w-3" /> Report
                  </button>
                )}
              </div>

              <Link to={detailPath} className="mt-2 block text-xl font-black leading-6 text-white hover:text-blue-200 sm:max-w-xl sm:text-2xl sm:leading-7">
                {item.title}
              </Link>

              {item.publicLocation && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-white/75">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="line-clamp-2">{item.publicLocation}</span>
                </p>
              )}

              {item.summaryAttributes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.summaryAttributes.map((attribute) => (
                    <span key={attribute} className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/85 backdrop-blur-sm">{attribute}</span>
                  ))}
                </div>
              )}

              <div className={cn('mt-4 grid gap-2 border-t border-white/10 pt-3', actionGridClass)}>
                {listingOnly && (
                  <button type="button" onClick={toggleSave} aria-label={liked ? 'Remove from saved' : 'Save listing'} aria-pressed={liked} disabled={saving} className={cn(overlayActionClass, liked && 'text-red-300')}>
                    <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
                    {liked ? 'Saved' : 'Save'}
                  </button>
                )}
                {canMessage ? (
                  <button type="button" onClick={openChat} aria-label="Message seller" className={overlayActionClass}>
                    <MessageCircle className="h-4 w-4" /> Message
                  </button>
                ) : !isOwner ? (
                  <Link to={publicTourDetailPath(item, { openTour: false })} aria-label="Contact provider" className={overlayActionClass}>
                    <MessageCircle className="h-4 w-4" /> Contact
                  </Link>
                ) : null}
                <button type="button" onClick={share} aria-label="Share listing" className={overlayActionClass}>
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">Price</p>
                  <p className="mt-0.5 truncate text-xl font-black text-white sm:text-2xl">{priceLabel(item, format)}</p>
                </div>
                <Link
                  to={detailPath}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-lg transition-colors hover:bg-primary-hover sm:text-sm"
                >
                  View listing <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Link>
              </div>
            </div>
          </>
        )}

        {playbackError && (
          <div className="absolute inset-x-3 bottom-3 z-30 rounded-xl border border-white/15 bg-black/80 p-3 text-white backdrop-blur-md">
            <p className="text-sm font-semibold">Peek playback failed</p>
            <button type="button" onClick={loadPlayback} className="mt-1 min-h-11 text-xs font-semibold text-blue-300">Try again</button>
          </div>
        )}
      </div>

      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action={guestAction} returnTo={detailPath} />
      {canMessage && <MessageDialog open={messageOpen} onClose={() => setMessageOpen(false)} listing={messageListing} type={item.listingType} />}
      {!isOwner && <TourReportDialog open={reportOpen} onOpenChange={setReportOpen} tourId={item.tourId} title={item.title} onReported={onReported} />}
    </article>
  );
}
