import { Building2, Car, Tractor, Wrench } from 'lucide-react';
import BackButton from '@/components/layout/BackButton';
import CategoryFilterChips from '@/components/search/CategoryFilterChips';
import { cn } from '@/lib/utils';

const TYPE_OPTIONS = [
  { value: 'property', label: 'Property', title: 'Property', icon: Building2 },
  { value: 'car', label: 'Vehicles', title: 'Vehicles', icon: Car },
  { value: 'machinery', label: 'Equipment', title: 'Heavy Equipment', icon: Tractor },
  { value: 'service', label: 'Services', title: 'Services', icon: Wrench },
];

export default function CategoryResultsHeader({ type, category, onTypeChange, onCategorySelect }) {
  const current = TYPE_OPTIONS.find((item) => item.value === type) || TYPE_OPTIONS[0];
  const CurrentIcon = current.icon;

  return (
    <div>
      <div className="flex items-center gap-3">
        <BackButton className="-ml-2 shrink-0" />
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <CurrentIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Browse</p>
            <h1 className="truncate text-lg font-bold sm:text-xl">{current.title}</h1>
          </div>
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Marketplace category">
        {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={type === value}
            onClick={() => onTypeChange(value)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
              type === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <CategoryFilterChips type={type} category={category} onSelect={onCategorySelect} />
    </div>
  );
}
