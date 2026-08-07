import { Check, LockKeyhole } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high', requiresCurrency: true },
  { value: 'price_desc', label: 'Price: high to low', requiresCurrency: true },
  { value: 'most_viewed', label: 'Most viewed' },
];

export function getSortLabel(value, currency = '') {
  const option = SORT_OPTIONS.find((candidate) => candidate.value === value) || SORT_OPTIONS[0];
  return option.requiresCurrency && currency ? `${option.label} · ${currency}` : option.label;
}

export default function SortSheet({ open, onOpenChange, value, onChange, currency = '' }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle>Sort results</SheetTitle>
          <SheetDescription>
            {currency
              ? `Price sorting compares listings in ${currency} only.`
              : 'Choose a listing currency in Filters before sorting by price.'}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface-secondary">
          {SORT_OPTIONS.map((option) => {
            const active = option.value === value;
            const disabled = Boolean(option.requiresCurrency && !currency);
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  onChange(option.value);
                  onOpenChange(false);
                }}
                className={cn(
                  'flex min-h-12 w-full items-center justify-between border-b border-border px-4 text-left text-sm last:border-0 hover:bg-surface-raised',
                  active && 'font-semibold text-primary',
                  disabled && 'cursor-not-allowed text-muted-foreground/60 hover:bg-transparent',
                )}
              >
                <span>{option.label}</span>
                {active ? <Check className="h-4 w-4" /> : disabled ? <LockKeyhole className="h-4 w-4" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
