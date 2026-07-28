import { cn } from '@/lib/utils';

const CATEGORIES = [
  ['all', 'All'],
  ['property', 'Property'],
  ['car', 'Vehicles'],
  ['machinery', 'Equipment'],
  ['service', 'Services'],
];

export default function TourCategoryChips({ value, onChange }) {
  return (
    <nav aria-label="Tour categories" className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
      {CATEGORIES.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={cn(
            'min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors',
            value === key
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
