import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ListingSummary({
  badges = null,
  price,
  pricePrefix = null,
  title,
  location = '',
  metadata = [],
  className = '',
}) {
  const items = metadata.filter(Boolean);

  return (
    <section
      aria-label="Listing summary"
      className={cn(
        'relative z-10 mx-3 -mt-3 rounded-[1.75rem] border border-border/80 bg-background/95 p-5 shadow-floating backdrop-blur-xl sm:mx-5 sm:p-6 md:mx-0 md:mt-5 md:rounded-3xl md:bg-card/90',
        className,
      )}
    >
      {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}

      <div className={cn('flex flex-col gap-1', badges && 'mt-4')}>
        <p className="flex flex-wrap items-baseline gap-x-2 text-primary">
          {pricePrefix && <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">{pricePrefix}</span>}
          <span className="text-[2rem] font-black leading-none tracking-[-0.04em] sm:text-[2.4rem]">{price}</span>
        </p>
        <h1 className="mt-2 text-[1.55rem] font-black leading-tight tracking-[-0.035em] text-foreground sm:text-3xl">{title}</h1>
      </div>

      {location && (
        <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-muted/35 px-3 py-2 text-sm font-medium text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{location}</span>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-border/60 pt-3 text-xs font-medium text-muted-foreground">
          {items.map((item, index) => (
            <span key={typeof item === 'string' ? item : `listing-meta-${index}`} className="inline-flex items-center gap-2">
              {index > 0 && <span className="h-1 w-1 rounded-full bg-muted-foreground/45" aria-hidden="true" />}
              {item}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
