import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/CurrencyContext";
import { Layers } from "lucide-react";

// Displays selectable pricing variants on a listing detail page.
export default function VariantSelector({ variants = [], selectedIndex, onSelect }) {
  const { format } = useCurrency();
  const valid = (variants || []).filter((v) => v && Number(v.price) > 0);
  if (valid.length === 0) return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
        <Layers className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">Choose an option</p>
      </div>
      <div className="p-2 space-y-2">
        {valid.map((v, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={selectedIndex === i}
            aria-label={`Select ${v.label || `option ${i + 1}`} for ${format(Number(v.price))}`}
            onClick={() => onSelect(i)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all flex items-center justify-between gap-3",
              selectedIndex === i
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40"
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{v.label || `Option ${i + 1}`}</p>
              {v.detail && <p className="text-xs text-muted-foreground truncate">{v.detail}</p>}
            </div>
            <span className="text-sm font-bold text-primary whitespace-nowrap">{format(Number(v.price))}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
