import { cn } from '@/lib/utils';

/**
 * Canonical PeekaListing lockup. The SVG stays crisp from favicon size through
 * desktop navigation while preserving the existing responsive layout contract.
 */
export default function BrandLogo({
  className = undefined,
  markClassName = undefined,
  wordmarkClassName = undefined,
  showWordmark = true,
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} aria-label="PeekaListing">
      <img
        src="/brand/peekalisting-binoculars.svg"
        alt=""
        className={cn('h-8 w-8 shrink-0 object-contain', markClassName)}
        aria-hidden="true"
        loading="eager"
        decoding="async"
      />
      {showWordmark && (
        <span className={cn('whitespace-nowrap text-xl font-black tracking-[-0.04em] text-foreground', wordmarkClassName)}>
          Peeka<span className="text-primary">Listing</span>
        </span>
      )}
    </span>
  );
}
