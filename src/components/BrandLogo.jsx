import { cn } from '@/lib/utils';

/**
 * The live mark and wordmark keep the brand crisp at every responsive size.
 */
export default function BrandLogo({
  className = undefined,
  markClassName = undefined,
  wordmarkClassName = undefined,
  showWordmark = true,
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} aria-hidden="true">
      <span className={cn('findit-brand-mark h-8 w-8 shrink-0', markClassName)} aria-hidden="true" />
      {showWordmark && (
        <span className={cn('whitespace-nowrap text-xl font-black text-foreground', wordmarkClassName)}>
          Find<span className="text-primary">It</span>
        </span>
      )}
    </span>
  );
}
