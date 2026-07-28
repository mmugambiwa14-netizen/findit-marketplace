import { X } from 'lucide-react';

export default function ActiveFilterChips({ filters = [], onRemove, onClear }) {
  if (filters.length === 0) return null;

  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0" aria-label="Active filters">
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onRemove(filter.key)}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15"
          aria-label={`Remove ${filter.label} filter`}
        >
          {filter.label}
          <X className="h-3.5 w-3.5" />
        </button>
      ))}
      <button type="button" onClick={onClear} className="min-h-11 shrink-0 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
        Clear all
      </button>
    </div>
  );
}
