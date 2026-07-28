import { readStoredString, removeStoredValue, writeStoredString } from '@/lib/browserStorage';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Flag, Heart, MapPin, MessageCircle, Play, RotateCcw, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import MessageDialog from '@/components/listings/MessageDialog';
import TourReportDialog from '@/components/tours/TourReportDialog';
import { Button } from '@/components/ui/button';
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
      setGuestAction('chat with this seller');
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
    <article data-tour-id={item.tourId} className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="relative aspect-video overflow-hidden bg-surface-secondary">
        {active && playback?.playbackUrl && !playbackError ? (
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
            onEnded={() => removeStoredValue('session', playbackKey(item.tourId))}
            onError={() => { setPlayback(null); setPlaybackError(true); }}
          />
        ) : (
          <button type="button" onClick={loadPlayback} className="group relative block h-full w-full text-left" aria-label={`Play Tour for ${item.title}`} disabled={loadingPlayback}>
            {item.thumbnailUrl || item.coverImageUrl ? (
              <img src={item.thumbnailUrl || item.coverImageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
            ) : (
              <div className="h-full w-full bg-surface-raised" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/10" aria-hidden="true" />
            <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur-md transition-transform group-hover:scale-105">
              {loadingPlayback ? <RotateCcw className="h-6 w-6 animate-spin" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
            </span>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">{formatDuration(item.durationSeconds)}</span>
          </button>
        )}
        {playbackError && (
          <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/15 bg-black/75 p-3 text-white backdrop-blur-md">
            <p className="text-sm font-semibold">Tour playback failed</p>
            <button type="button" onClick={loadPlayback} className="mt-1 min-h-11 text-xs font-semibold text-blue-300">Try again</button>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xl font-black text-primary">{priceLabel(item, format)}</p>
            <Link to={detailPath} className="mt-1 block text-lg font-bold leading-6 hover:text-primary">{item.title}</Link>
            {item.publicLocation && <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{item.publicLocation}</span></p>}
          </div>
          <span className="shrink-0 rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.listingType === 'car' ? 'Vehicle' : item.listingType === 'machinery' ? 'Equipment' : item.listingType}</span>
        </div>

        {item.summaryAttributes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.summaryAttributes.map((attribute) => <span key={attribute} className="rounded-full bg-surface-secondary px-3 py-1.5 text-xs text-muted-foreground">{attribute}</span>)}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Listed by {item.sellerDisplayName}</p>
          {!isOwner && <button type="button" onClick={openReport} className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-surface-secondary hover:text-destructive"><Flag className="h-3.5 w-3.5" />Report Tour</button>}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-4">
          {listingOnly ? (
            <button type="button" onClick={toggleSave} aria-pressed={liked} disabled={saving} className={cn('flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold hover:bg-surface-secondary disabled:cursor-wait disabled:opacity-60', liked && 'text-destructive')}>
              <Heart className={cn('h-4 w-4', liked && 'fill-current')} /> Save
            </button>
          ) : (
            <Link to={detailPath} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold hover:bg-surface-secondary"><Play className="h-4 w-4" /> Work</Link>
          )}
          <button type="button" onClick={share} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold hover:bg-surface-secondary"><Share2 className="h-4 w-4" /> Share</button>
          {canMessage ? (
            <button type="button" onClick={openChat} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold hover:bg-surface-secondary"><MessageCircle className="h-4 w-4" /> Chat</button>
          ) : (
            <Link to={publicTourDetailPath(item, { openTour: false })} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold hover:bg-surface-secondary"><MessageCircle className="h-4 w-4" /> Contact</Link>
          )}
          <Button asChild size="sm" className="h-auto min-h-11 rounded-xl px-2 text-[11px]"><Link to={detailPath}>View listing</Link></Button>
        </div>
      </div>

      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action={guestAction} returnTo={detailPath} />
      {canMessage && <MessageDialog open={messageOpen} onClose={() => setMessageOpen(false)} listing={messageListing} type={item.listingType} />}
      {!isOwner && <TourReportDialog open={reportOpen} onOpenChange={setReportOpen} tourId={item.tourId} title={item.title} onReported={onReported} />}
    </article>
  );
}
