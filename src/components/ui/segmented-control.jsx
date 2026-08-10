import { cn } from '@/lib/utils';
import { Pressable } from '@/components/ui/pressable';
import { motionDurations, motionEasings, prefersReducedMotion } from '@/lib/motionTokens';

export function SegmentedControl({
  value,
  onValueChange,
  options,
  ariaLabel,
  className = '',
  indicatorClassName = '',
  buttonClassName = '',
  size = 'default',
}) {
  const items = Array.isArray(options) ? options.filter(Boolean) : [];
  const activeIndex = Math.max(0, items.findIndex((item) => item.value === value));
  const columns = Math.max(1, items.length);
  const indicatorTransition = prefersReducedMotion()
    ? 'none'
    : `transform ${motionDurations.standard}ms ${motionEasings.standard}, width ${motionDurations.standard}ms ${motionEasings.standard}`;

  if (!items.length) return null;

  return (
    <div
      className={cn('fluid-segmented-control relative isolate overflow-hidden rounded-xl border border-border/75 p-1', size === 'compact' && 'text-sm', className)}
      role="group"
      aria-label={ariaLabel}
    >
      <span
        aria-hidden="true"
        className={cn('fluid-segmented-indicator absolute inset-y-1 left-1 z-0 rounded-lg bg-card/95', indicatorClassName)}
        style={{
          width: `calc((100% - 0.5rem) / ${columns})`,
          transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
          transition: indicatorTransition,
        }}
      />
      <div className="relative z-[1] grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const selected = item.value === value;
          return (
            <Pressable
              key={item.value}
              type="button"
              aria-pressed={selected}
              aria-label={item.ariaLabel || item.label}
              onClick={() => onValueChange?.(item.value)}
              className={cn(
                'relative z-[1] inline-flex min-h-9 items-center justify-center px-2.5 font-semibold text-muted-foreground',
                selected && 'text-foreground',
                buttonClassName,
                item.className,
              )}
            >
              {Icon && <Icon aria-hidden="true" className="h-[1.05rem] w-[1.05rem] shrink-0" />}
              {item.label && <span className={cn(item.hideLabelOnSmall && 'hidden min-[400px]:inline')}>{item.label}</span>}
            </Pressable>
          );
        })}
      </div>
    </div>
  );
}
