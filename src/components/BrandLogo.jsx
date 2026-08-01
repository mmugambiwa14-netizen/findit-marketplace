import { cn } from '@/lib/utils';
import brandMark from '@/assets/brand/findit-mark.png';

/**
 * The image carries the marketplace symbol while the live wordmark keeps the
 * product name sharp, selectable, and accessible at every responsive size.
 */
export default function BrandLogo({
  className = undefined,
  markClassName = undefined,
  wordmarkClassName = undefined,
  showWordmark = true,
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} aria-hidden="true">
      <img
        src={brandMark}
        alt=""
        width="256"
        height="256"
        loading="eager"
        decoding="async"
        className={cn('h-8 w-8 shrink-0 object-contain', markClassName)}
      />
      {showWordmark && (
        <span className={cn('whitespace-nowrap text-xl font-black text-foreground', wordmarkClassName)}>
          Find<span className="text-primary">It</span>
        </span>
      )}
    </span>
  );
}
