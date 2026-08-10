import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

const MOVE_CANCEL_THRESHOLD = 10;

/**
 * @typedef {React.ButtonHTMLAttributes<HTMLButtonElement> & {
 *   asChild?: boolean,
 * }} PressableProps
 */

const Pressable = React.forwardRef(
  /** @type {React.ForwardRefRenderFunction<HTMLButtonElement, PressableProps>} */
  (({
    asChild = false,
    className,
    disabled = false,
    type,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onKeyDown,
    onKeyUp,
    onBlur,
    onClick,
    children,
    ...props
  }, ref) => {
    const [pressed, setPressed] = React.useState(false);
    const pointer = React.useRef(null);
    const Comp = asChild ? Slot : 'button';
    const ariaDisabled = props['aria-disabled'] === true || props['aria-disabled'] === 'true';
    const blocked = Boolean(disabled || ariaDisabled);

    const clearPress = React.useCallback(() => {
      pointer.current = null;
      setPressed(false);
    }, []);

    const handlePointerDown = (event) => {
      onPointerDown?.(event);
      if (event.defaultPrevented || blocked || event.button > 0) return;
      pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      setPressed(true);
    };

    const handlePointerMove = (event) => {
      onPointerMove?.(event);
      const origin = pointer.current;
      if (!origin || origin.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > MOVE_CANCEL_THRESHOLD) setPressed(false);
    };

    const handlePointerUp = (event) => {
      onPointerUp?.(event);
      clearPress();
    };

    const handlePointerCancel = (event) => {
      onPointerCancel?.(event);
      clearPress();
    };

    const handlePointerLeave = (event) => {
      onPointerLeave?.(event);
      if (pointer.current) setPressed(false);
    };

    const handleKeyDown = (event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || blocked) return;
      if (event.key === 'Enter' || event.key === ' ') setPressed(true);
    };

    const handleKeyUp = (event) => {
      onKeyUp?.(event);
      if (event.key === 'Enter' || event.key === ' ') setPressed(false);
    };

    const handleBlur = (event) => {
      onBlur?.(event);
      clearPress();
    };

    const handleClick = (event) => {
      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onClick?.(event);
    };

    return (
      <Comp
        ref={ref}
        className={cn('fluid-pressable', className)}
        data-pressed={pressed ? 'true' : 'false'}
        data-disabled={blocked ? 'true' : 'false'}
        type={asChild ? undefined : (type ?? 'button')}
        disabled={asChild ? undefined : disabled}
        aria-disabled={asChild && blocked ? true : props['aria-disabled']}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={handleBlur}
        onClick={handleClick}
        {...props}
      >
        {children}
      </Comp>
    );
  }),
);

Pressable.displayName = 'Pressable';

export { Pressable };
