import * as React from 'react';
import { cn } from '@/lib/utils';
import { Pressable } from '@/components/ui/pressable';

export function AnimatedTabs({
  value,
  onValueChange,
  tabs,
  ariaLabel,
  className = '',
  tabClassName = '',
  indicatorClassName = '',
  semantics = 'tabs',
}) {
  const items = Array.isArray(tabs) ? tabs.filter(Boolean) : [];
  const containerRef = React.useRef(null);
  const tabRefs = React.useRef(new Map());
  const [indicator, setIndicator] = React.useState({ x: 0, width: 0, ready: false });
  const tabSemantics = semantics === 'tabs';

  const measure = React.useCallback(() => {
    const active = tabRefs.current.get(value);
    if (!active) {
      setIndicator((current) => ({ ...current, ready: false }));
      return;
    }
    setIndicator({ x: active.offsetLeft, width: active.offsetWidth, ready: true });
  }, [value]);

  React.useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return undefined;

    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(container);
      for (const node of tabRefs.current.values()) observer.observe(node);
    }
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [items.length, measure]);

  React.useEffect(() => {
    const container = containerRef.current;
    const active = tabRefs.current.get(value);
    if (!container || !active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    const visibleLeft = container.scrollLeft;
    const visibleRight = visibleLeft + container.clientWidth;
    if (left < visibleLeft) container.scrollTo({ left: Math.max(0, left - 8), behavior: 'auto' });
    else if (right > visibleRight) container.scrollTo({ left: right - container.clientWidth + 8, behavior: 'auto' });
  }, [value]);

  const handleTabKeyDown = (event, index) => {
    if (!tabSemantics) return;
    const last = items.length - 1;
    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') nextIndex = index === 0 ? last : index - 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = last;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = items[nextIndex];
    onValueChange?.(next.value);
    window.requestAnimationFrame(() => tabRefs.current.get(next.value)?.focus());
  };

  if (!items.length) return null;

  return (
    <div
      ref={containerRef}
      className={cn('fluid-tabs no-scrollbar', className)}
      role={tabSemantics ? 'tablist' : 'group'}
      aria-label={ariaLabel}
    >
      <span
        aria-hidden="true"
        className={cn('fluid-tabs-indicator', !indicator.ready && 'opacity-0', indicatorClassName)}
        style={{ width: indicator.width, transform: `translate3d(${indicator.x}px, 0, 0)` }}
      />
      {items.map((tab, index) => {
        const Icon = tab.icon;
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            ref={(node) => {
              if (node) tabRefs.current.set(tab.value, node);
              else tabRefs.current.delete(tab.value);
            }}
            type="button"
            role={tabSemantics ? 'tab' : undefined}
            aria-selected={tabSemantics ? selected : undefined}
            aria-current={!tabSemantics && selected ? 'location' : undefined}
            aria-controls={tabSemantics ? tab.controls : undefined}
            tabIndex={tabSemantics ? (selected ? 0 : -1) : undefined}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            onClick={() => onValueChange?.(tab.value)}
            className={cn('fluid-tab', selected && 'fluid-tab--active', tabClassName, tab.className)}
          >
            {Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />}
            <span>{tab.label}</span>
          </Pressable>
        );
      })}
    </div>
  );
}
