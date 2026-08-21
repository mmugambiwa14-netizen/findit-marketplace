import { useState } from 'react';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Reveals advisory copy on request instead of printing it under every control.
 *
 * Use this for guidance a person can act without: what a field is for, what
 * happens after a choice, why a limit exists. Do not use it for anything the
 * screen is obliged to state up front -- errors, empty and degraded states,
 * status, or safety guidance -- which the design contract requires to stay
 * explicit.
 *
 * The trigger occupies a real 44 px box around a 16 px icon. An earlier version
 * drew a 24 px button and grew the target with a negative-inset pseudo-element,
 * which kept the layout tight but overlapped whatever sat next to it: beside a
 * button with a 4 px gap it swallowed the last 6 px of that button's clicks.
 * Real space costs a little whitespace and cannot overlap a neighbour.
 *
 * @param {{
 *   label: string,
 *   children: import('react').ReactNode,
 *   className?: string,
 *   align?: 'start' | 'center' | 'end',
 *   side?: 'top' | 'right' | 'bottom' | 'left',
 * }} props
 */
export default function InfoHint({ label, children, className = undefined, align = 'start', side = 'bottom' }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        className={cn(
          'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
          'text-muted-foreground transition-colors hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          open && 'text-foreground',
          className,
        )}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        // Kept off the viewport edge through Radix rather than a max-width
        // utility, which would add a class to the stylesheet for no benefit.
        collisionPadding={12}
        className="p-3 text-sm leading-6 text-muted-foreground"
      >
        <p className="font-semibold text-foreground">{label}</p>
        <div className="mt-1 space-y-2">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * A form label and its info button on one baseline.
 *
 * Most advisory copy hangs off a label, so pairing them here keeps the control
 * association intact and stops the two drifting apart as screens are edited.
 */
export function LabelWithHint({
  htmlFor,
  children,
  hint = null,
  hintLabel = undefined,
  className = undefined,
  labelClassName = undefined,
}) {
  const accessibleName = hintLabel ?? (typeof children === 'string' ? children : undefined);
  return (
    <div className={cn('flex items-center', className)}>
      <Label htmlFor={htmlFor} className={labelClassName}>{children}</Label>
      {hint ? <InfoHint label={accessibleName}>{hint}</InfoHint> : null}
    </div>
  );
}
