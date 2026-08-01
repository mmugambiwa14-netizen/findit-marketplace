import { Building2, Car, Tractor, Wrench } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import BackButton from '@/components/layout/BackButton';
import CategoryFilterChips from '@/components/search/CategoryFilterChips';
import { cn } from '@/lib/utils';

const TYPE_OPTIONS = [
  { value: 'property', label: 'Property', title: 'Property', icon: Building2 },
  { value: 'car', label: 'Cars', title: 'Cars', icon: Car },
  { value: 'machinery', label: 'Machinery', title: 'Machinery', icon: Tractor },
  { value: 'service', label: 'Services', title: 'Services', icon: Wrench },
];

function serviceBrowsePath(search) {
  const current = new URLSearchParams(search);
  const next = new URLSearchParams();
  for (const key of ['q', 'location', 'locationName', 'country', 'province']) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `/services?${query}` : '/services';
}

export default function CategoryResultsHeader({ type, category, onTypeChange, onCategorySelect }) {
  const navigate = useNavigate();
  const location = useLocation();
  const current = TYPE_OPTIONS.find((item) => item.value === type) || TYPE_OPTIONS[0];
  const CurrentIcon = current.icon;

  const changeType = (value) => {
    if (value === type) return;
    if (value === 'service') {
      navigate(serviceBrowsePath(location.search));
      return;
    }
    onTypeChange(value);
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <BackButton className="-ml-2 shrink-0" />
        <div className="flex min-w-0 items-center gap-3">
          <span className="clay-icon h-11 w-11 shrink-0 border-primary/20 bg-primary/10 text-primary">
            <CurrentIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="findit-overline">Browse marketplace</p>
            <h1 className="mt-0.5 truncate text-xl font-black tracking-tight sm:text-2xl">{current.title}</h1>
          </div>
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto" role="tablist" aria-label="Marketplace category">
        {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={type === value}
            onClick={() => changeType(value)}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold',
              type === value
                ? 'clay-button border-primary text-primary-foreground'
                : 'clay-soft border-border text-muted-foreground hover:text-foreground',
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
