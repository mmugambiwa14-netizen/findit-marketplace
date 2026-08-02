import { Building2, CarFront, Sparkles, Tractor, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { key: 'all', label: 'All', icon: Sparkles },
  { key: 'property', label: 'Property', icon: Building2 },
  { key: 'car', label: 'Cars', icon: CarFront },
  { key: 'machinery', label: 'Machinery', icon: Tractor },
  { key: 'service', label: 'Services', icon: Wrench },
];

export default function TourCategoryChips({ value, onChange }) {
  return (
    <nav aria-label="Peek categories" className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5">
      {CATEGORIES.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold',
            value === key
              ? 'clay-button border-primary text-primary-foreground'
              : 'clay-soft border-border text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  );
}
