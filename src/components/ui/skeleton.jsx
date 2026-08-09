import { cn } from '@/lib/utils';

export function Skeleton({ className = '', ...props }) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-xl bg-muted/80 motion-reduce:animate-none',
        className,
      )}
    />
  );
}

export function SkeletonRegion({ label = 'Loading content', className = '', children, ...props }) {
  return (
    <div
      {...props}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={className}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
