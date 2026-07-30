import { Link } from 'react-router-dom';
import { Building2, Eye, Heart, ImageOff, MapPin, Play } from 'lucide-react';
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
  views = null,
  actions = null,
  layout = 'grid',
  className = null,
  onOpen = null,
}) {
  const publicTour = tour && (tour.status === 'ready' || tour.status === 'approved' || tour.isReady === true);
  const tourDuration = publicTour ? formatDuration(tour.durationSeconds) : null;
  const tourTarget = `${to}${to.includes('?') ? '&' : '?'}media=tour`;
  const browseLayout = layout === 'browse';
  const viewCount = Number.isFinite(Number(views)) ? Math.max(0, Number(views)) : null;

  const media = (
    <div className={cn(
      'relative aspect-[4/3] overflow-hidden bg-surface-secondary',
      browseLayout && 'aspect-auto min-h-[13rem] sm:aspect-[4/3] sm:min-h-0',
    )}>
      <Link to={to} className="block h-full focus-visible:ring-inset" aria-label={`${title}, ${priceLabel}`} onClick={onOpen}>
        {imageUrl || fallbackImageUrl ? (
          <img
            src={imageUrl || fallbackImageUrl}
            alt={imageAlt || title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
            onError={(event) => {
              if (fallbackImageUrl && event.currentTarget.src !== fallbackImageUrl) event.currentTarget.src = fallbackImageUrl;
            }}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageOff className="h-6 w-6" /></span>
        )}
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 via-black/10 to-transparent" aria-hidden="true" />
        {badges.length > 0 && (
          <span className="absolute left-2.5 top-2.5 flex max-w-[calc(100%-4rem)] flex-wrap gap-1.5">
            {badges.map((badge) => (
              <Badge key={`${badge.label}-${badge.variant || 'default'}`} variant={badge.variant || 'secondary'} className={cn('border-black/10 bg-background/85 text-[10px] text-foreground backdrop-blur-md', badge.className)}>
                {badge.label}
              </Badge>
            ))}
          </span>
        )}
        <span className={cn('absolute bottom-2.5 left-3 right-3 truncate text-base font-extrabold tracking-tight text-white sm:text-lg', browseLayout && 'hidden sm:block')}>
          {priceLabel}
        </span>
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
          className="absolute bottom-2.5 left-2.5 z-10 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-2.5 text-[10px] font-semibold text-white backdrop-blur-md hover:bg-black/85"
          aria-label={`${tourLabel} for ${title}${tourDuration ? `, ${tourDuration}` : ''}`}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {tourLabel}{tourDuration ? ` · ${tourDuration}` : ''}
        </Link>
      )}
    </div>
  );

  const details = (
    <Link to={to} className={cn('block p-3 focus-visible:ring-inset sm:p-3.5', browseLayout && 'min-w-0')} onClick={onOpen}>
      {browseLayout && meta && <p className="mb-1 line-clamp-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary sm:hidden">{meta}</p>}
      {browseLayout && <p className="mb-1 text-lg font-extrabold tracking-tight text-foreground sm:hidden">{priceLabel}</p>}
      <h3 className={cn('line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground', browseLayout && 'line-clamp-3 min-h-0 text-[15px] leading-5 sm:line-clamp-2 sm:min-h-10 sm:text-sm')}>
        {title}
      </h3>
      {codeNode}
      {attributes.length > 0 && (
        <span className={cn('mt-3 min-h-5 gap-x-2.5 gap-y-1.5 text-[11px] text-muted-foreground', browseLayout ? 'grid grid-cols-2 sm:flex sm:flex-wrap' : 'flex items-center overflow-hidden')}>
          {attributes.slice(0, 4).map((attribute, index) => {
            const Icon = attribute.icon;
            return (
              <span key={`${attribute.label}-${index}`} className={cn('flex items-center gap-1 whitespace-nowrap', browseLayout ? 'min-w-0' : 'min-w-0 shrink')}>
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                <span className={cn(browseLayout ? 'truncate sm:overflow-visible sm:text-clip' : 'truncate')}>{attribute.label}</span>
              </span>
            );
          })}
        </span>
      )}
      {meta && <span className={cn('mt-2.5 border-t border-border pt-2.5 text-[10px] text-muted-foreground', browseLayout && 'hidden sm:block')}><span className="block truncate">{meta}</span></span>}
    </Link>
  );

  return (
    <article className={cn('group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-floating', className)}>
      <div className={cn(browseLayout && 'grid grid-cols-[10.25rem_minmax(0,1fr)] sm:block')}>
        {media}
        {details}
      </div>

      {browseLayout && locationLabel && (
        <Link to={to} onClick={onOpen} className="flex min-h-11 items-center gap-2 border-t border-border bg-surface-secondary/20 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <span className="line-clamp-2">{locationLabel}</span>
        </Link>
      )}

      {!browseLayout && locationLabel && (
        <Link to={to} onClick={onOpen} className="flex items-start gap-1.5 px-3 pb-3 text-xs text-muted-foreground sm:px-3.5 sm:pb-3.5">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{locationLabel}</span>
        </Link>
      )}

      {browseLayout && (sellerName || viewCount !== null || actions) && (
        <div className="border-t border-border">
          {(sellerName || viewCount !== null) && (
            <div className="grid grid-cols-2 divide-x divide-border bg-surface-secondary/35">
              <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground"><Building2 className="h-4 w-4" /></span>
                <div className="min-w-0"><p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Seller</p><p className="truncate text-xs font-semibold text-foreground">{sellerName || 'Private seller'}</p></div>
              </div>
              <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground"><Eye className="h-4 w-4" /></span>
                <div className="min-w-0"><p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Views</p><p className="text-xs font-semibold text-foreground">{(viewCount ?? 0).toLocaleString()}</p></div>
              </div>
            </div>
          )}
          {actions && <div className="p-2.5">{actions}</div>}
        </div>
      )}
    </article>
  );
}
