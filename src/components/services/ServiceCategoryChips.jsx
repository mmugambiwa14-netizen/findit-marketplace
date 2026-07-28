import { cn } from "@/lib/utils";
import { V1_SERVICE_CATEGORIES } from "@/lib/serviceConstants";

export default function ServiceCategoryChips({ value, onChange }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Service categories">
      <CategoryButton active={value === "all"} onClick={() => onChange("all")}>All services</CategoryButton>
      {V1_SERVICE_CATEGORIES.map((category) => {
        const Icon = category.icon;
        return <CategoryButton key={category.value} active={value === category.value} onClick={() => onChange(category.value)}><Icon className="h-4 w-4" aria-hidden="true" />{category.label}</CategoryButton>;
      })}
    </div>
  );
}

function CategoryButton({ active, onClick, children }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={cn("flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground")}>{children}</button>;
}
