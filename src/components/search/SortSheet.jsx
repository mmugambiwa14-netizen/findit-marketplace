import { Check } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'most_viewed', label: 'Most viewed' },
];

export function getSortLabel(value) {
  return SORT_OPTIONS.find((option) => option.value === value)?.label || SORT_OPTIONS[0].label;
}

export default function SortSheet({ open, onOpenChange, value, onChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle>Sort results</SheetTitle>
          <SheetDescription>Choose how listings are ordered.</SheetDescription>
        </SheetHeader>
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface-secondary">
          {SORT_OPTIONS.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  onOpenChange(false);
                }}
                className={cn('flex min-h-12 w-full items-center justify-between border-b border-border px-4 text-left text-sm last:border-0 hover:bg-surface-raised', active && 'font-semibold text-primary')}
              >
                {option.label}
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
