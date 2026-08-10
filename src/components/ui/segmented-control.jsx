import { cn } from '@/lib/utils';
import { Pressable } from '@/components/ui/pressable';

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

  if (!items.length) return null;

  return (
    <div
      className={cn('fluid-segmented-control', size === 'compact' && 'fluid-segmented-control--compact', className)}
      role="group"
      aria-label={ariaLabel}
    >
      <span
        aria-hidden="true"
        className={cn('fluid-segmented-indicator', indicatorClassName)}
        style={{
          width: `calc((100% - 0.5rem) / ${columns})`,
          transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
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
                'fluid-segmented-button',
                selected && 'fluid-segmented-button--active',
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
