import { Link } from 'react-router-dom';
import { Heart, ImageOff, MapPin, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function formatDuration(seconds) {
  const duration = Number(seconds);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const minutes = Math.floor(duration / 60);
  const remainder = Math.floor(duration % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function MarketplaceCard({
  to,
  imageUrl,
  fallbackImageUrl = null,
  imageAlt,
  title,
  priceLabel,
  locationLabel,
  attributes = [],
  meta = null,
  codeNode = null,
  badges = [],
  save = null,
  tour = null,
  tourLabel = 'Tour',
  className = null,
}) {
  const publicTour = tour && (tour.status === 'ready' || tour.status === 'approved' || tour.isReady === true);
  const tourDuration = publicTour ? formatDuration(tour.durationSeconds) : null;
  const tourTarget = `${to}${to.includes('?') ? '&' : '?'}media=tour`;

  return (
    <article className={cn('group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-floating', className)}>
      <Link to={to} className="block focus-visible:ring-inset" aria-label={`${title}, ${priceLabel}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-secondary">
          {imageUrl || fallbackImageUrl ? (
            <img
              src={imageUrl || fallbackImageUrl}
              alt={imageAlt || title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
              onError={(event) => {
                if (fallbackImageUrl && event.currentTarget.src !== fallbackImageUrl) {
                  event.currentTarget.src = fallbackImageUrl;
                }
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageOff className="h-6 w-6" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 via-black/10 to-transparent" aria-hidden="true" />
          {badges.length > 0 && (
            <div className="absolute left-2.5 top-2.5 flex max-w-[calc(100%-4rem)] flex-wrap gap-1.5">
              {badges.map((badge) => (
                <Badge key={`${badge.label}-${badge.variant || 'default'}`} variant={badge.variant || 'secondary'} className={cn('border-black/10 bg-background/85 text-[10px] text-foreground backdrop-blur-md', badge.className)}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
          <p className="absolute bottom-2.5 left-3 right-3 truncate text-base font-extrabold tracking-tight text-white sm:text-lg">
            {priceLabel}
          </p>
        </div>

        <div className="p-3 sm:p-3.5">
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground">{title}</h3>
          {codeNode}
          {locationLabel && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{locationLabel}</span>
            </p>
          )}
          {attributes.length > 0 && (
            <div className="mt-2.5 flex min-h-5 items-center gap-x-2.5 gap-y-1 overflow-hidden text-[11px] text-muted-foreground">
              {attributes.slice(0, 3).map((attribute, index) => {
                const Icon = attribute.icon;
                return (
                  <span key={`${attribute.label}-${index}`} className="flex min-w-0 shrink items-center gap-1 whitespace-nowrap">
                    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{attribute.label}</span>
                  </span>
                );
              })}
            </div>
          )}
          {meta && (
            <div className="mt-2.5 border-t border-border pt-2.5 text-[10px] text-muted-foreground">
              <span className="block truncate">{meta}</span>
            </div>
          )}
        </div>
      </Link>

      {save && (
        <button
          type="button"
          onClick={save.onToggle}
          aria-label={save.active ? 'Remove from saved' : 'Save listing'}
          aria-pressed={save.active}
          className="absolute right-2.5 top-2.5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-sm backdrop-blur-md transition-transform hover:scale-105 focus-visible:ring-offset-0 active:scale-95"
        >
          <Heart className={cn('h-[19px] w-[19px]', save.active && 'fill-destructive text-destructive')} />
        </button>
      )}

      {publicTour && (
        <Link
          to={tourTarget}
          className="absolute bottom-[calc(7.75rem)] left-2.5 z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-2.5 text-[10px] font-semibold text-white backdrop-blur-md hover:bg-black/80 sm:bottom-[calc(7.9rem)]"
          aria-label={`${tourLabel} for ${title}${tourDuration ? `, ${tourDuration}` : ''}`}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {tourLabel}{tourDuration ? ` · ${tourDuration}` : ''}
        </Link>
      )}
    </article>
  );
}
