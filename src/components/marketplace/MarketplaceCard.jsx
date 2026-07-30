import { Link } from 'react-router-dom';
import { Building2, Heart, ImageOff, MapPin, Play } from 'lucide-react';
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
  tourLabel = 'Peek',
  sellerName = null,
  actions = null,
  layout = 'grid',
  className = null,
  onOpen = null,
}) {
  const publicTour = tour && (tour.status === 'ready' || tour.status === 'approved' || tour.isReady === true);
  const tourDuration = publicTour ? formatDuration(tour.durationSeconds) : null;
  const tourTarget = `${to}${to.includes('?') ? '&' : '?'}media=tour`;
  const browseLayout = layout === 'browse';

  return (
    <article className={cn(
      'group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-floating',
      className,
    )}>
      <Link
        to={to}
        className={cn('block focus-visible:ring-inset', browseLayout && 'grid grid-cols-[8.75rem_minmax(0,1fr)] sm:block')}
        aria-label={`${title}, ${priceLabel}`}
        onClick={onOpen}
      >
        <div className={cn(
          'relative aspect-[4/3] overflow-hidden bg-surface-secondary',
          browseLayout && 'aspect-auto min-h-[11.25rem] sm:aspect-[4/3] sm:min-h-0',
        )}>
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
                <Badge
                  key={`${badge.label}-${badge.variant || 'default'}`}
                  variant={badge.variant || 'secondary'}
                  className={cn('border-black/10 bg-background/85 text-[10px] text-foreground backdrop-blur-md', badge.className)}
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
          <p className={cn(
            'absolute bottom-2.5 left-3 right-3 truncate text-base font-extrabold tracking-tight text-white sm:text-lg',
            browseLayout && 'hidden sm:block',
          )}>
            {priceLabel}
          </p>
        </div>

        <div className={cn('p-3 sm:p-3.5', browseLayout && 'min-w-0')}>
          {browseLayout && meta && (
            <p className="mb-1 line-clamp-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary sm:hidden">
              {meta}
            </p>
          )}
          {browseLayout && (
            <p className="mb-1 text-lg font-extrabold tracking-tight text-foreground sm:hidden">
              {priceLabel}
            </p>
          )}
          <h3 className={cn(
            'line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground',
            browseLayout && 'line-clamp-3 min-h-0 text-[15px] leading-5 sm:line-clamp-2 sm:min-h-10 sm:text-sm',
          )}>
            {title}
          </h3>
          {codeNode}
          {locationLabel && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className={cn(browseLayout ? 'line-clamp-2' : 'truncate')}>{locationLabel}</span>
            </p>
          )}
          {attributes.length > 0 && (
            <div className={cn(
              'mt-3 min-h-5 gap-x-2.5 gap-y-1.5 text-[11px] text-muted-foreground',
              browseLayout ? 'grid grid-cols-2 sm:flex sm:flex-wrap' : 'flex items-center overflow-hidden',
            )}>
              {attributes.slice(0, 4).map((attribute, index) => {
                const Icon = attribute.icon;
                return (
                  <span
                    key={`${attribute.label}-${index}`}
                    className={cn(
                      'flex items-center gap-1 whitespace-nowrap',
                      browseLayout ? 'min-w-0' : 'min-w-0 shrink',
                    )}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                    <span className={cn(browseLayout ? 'truncate sm:overflow-visible sm:text-clip' : 'truncate')}>{attribute.label}</span>
                  </span>
                );
              })}
            </div>
          )}
          {meta && (
            <div className={cn(
              'mt-2.5 border-t border-border pt-2.5 text-[10px] text-muted-foreground',
              browseLayout && 'hidden sm:block',
            )}>
              <span className="block truncate">{meta}</span>
            </div>
          )}
        </div>
      </Link>

      {browseLayout && (sellerName || actions) && (
        <div className="border-t border-border">
          {sellerName && (
            <div className="flex items-center gap-2.5 bg-surface-secondary/35 px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
                <Building2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Listed by</p>
                <p className="truncate text-xs font-semibold text-foreground">{sellerName}</p>
              </div>
            </div>
          )}
          {actions && <div className={cn('p-2.5', sellerName && 'pt-0')}>{actions}</div>}
        </div>
      )}

      {save && (
        <button
          type="button"
          onClick={save.onToggle}
          aria-label={save.active ? 'Remove from saved' : 'Save listing'}
          aria-pressed={save.active}
          className={cn(
            'absolute top-2.5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-sm backdrop-blur-md transition-transform hover:scale-105 focus-visible:ring-offset-0 active:scale-95',
            browseLayout ? 'left-[5.35rem] sm:left-auto sm:right-2.5' : 'right-2.5',
          )}
        >
          <Heart className={cn('h-[19px] w-[19px]', save.active && 'fill-destructive text-destructive')} />
        </button>
      )}

      {publicTour && (
        <Link
          to={tourTarget}
          className={cn(
            'absolute left-2.5 z-10 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-2.5 text-[10px] font-semibold text-white backdrop-blur-md hover:bg-black/80',
            browseLayout ? 'bottom-[6.85rem] sm:bottom-[10.9rem]' : 'bottom-[calc(7.75rem)] sm:bottom-[calc(7.9rem)]',
          )}
          aria-label={`${tourLabel} for ${title}${tourDuration ? `, ${tourDuration}` : ''}`}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {tourLabel}{tourDuration ? ` · ${tourDuration}` : ''}
        </Link>
      )}
    </article>
  );
}
