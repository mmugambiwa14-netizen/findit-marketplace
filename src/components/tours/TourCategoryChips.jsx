import { cn } from '@/lib/utils';

const CATEGORIES = [
  ['all', 'All Peeks'],
  ['property', 'Property'],
  ['car', 'Cars'],
  ['machinery', 'Machinery'],
  ['service', 'Services'],
];

export default function TourCategoryChips({ value, onChange }) {
  return (
    <nav aria-label="Peek categories" className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
      {CATEGORIES.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={cn(
            'min-h-10 shrink-0 rounded-full border px-3.5 text-xs font-semibold',
            value === key
              ? 'clay-button border-primary text-primary-foreground'
              : 'clay-soft border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
