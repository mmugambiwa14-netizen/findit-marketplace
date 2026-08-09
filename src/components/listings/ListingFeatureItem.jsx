import { cn } from '@/lib/utils';

export default function ListingFeatureItem({ icon: Icon, label, value }) {
  const displayValue = value === null || value === undefined || String(value).trim() === ''
    ? 'Not specified'
    : value;

  return (
    <div className={cn(
      'flex min-h-[4.25rem] items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-b-0 sm:px-5',
      'odd:bg-muted/20 transition-colors hover:bg-primary/5',
    )}>
      {Icon && (
        <span className="locked-icon-tile h-9 w-9 shrink-0 rounded-xl">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <p className="min-w-0 flex-1 text-sm font-medium text-foreground sm:text-[15px]">{label}</p>
      <p className="max-w-[58%] break-words text-right text-sm font-extrabold leading-5 text-foreground sm:max-w-[62%] sm:text-[15px]" title={String(displayValue)}>{displayValue}</p>
    </div>
  );
}
