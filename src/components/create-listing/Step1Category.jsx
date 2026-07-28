import { useState, useMemo } from "react";
import { CheckCircle2, Building2, Car, Tractor } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROPERTY_CATEGORIES, CAR_CATEGORIES, MACHINERY_CATEGORIES } from "@/lib/constants";
import StepNav from "./StepNav";

const CATEGORIES = [
  {
    key: "property",
    icon: Building2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    label: "Real Estate",
    desc: "Houses, apartments, land, BnBs, commercial property and anything property related",
    options: PROPERTY_CATEGORIES,
  },
  {
    key: "car",
    icon: Car,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    label: "Vehicles",
    desc: "Cars, trucks, buses, motorbikes, lorries, kombis and any road vehicle",
    options: CAR_CATEGORIES,
  },
  {
    key: "machinery",
    icon: Tractor,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-500/10",
    label: "Machinery & Equipment",
    desc: "Excavators, bulldozers, cranes, mining, generators, agricultural equipment and heavy machinery",
    options: MACHINERY_CATEGORIES,
  },
];

// Group flat option lists by their `group` key (machinery has no group → single list)
function groupOptions(options) {
  const groups = {};
  options.forEach(opt => {
    const g = opt.group || "All";
    if (!groups[g]) groups[g] = [];
    groups[g].push(opt);
  });
  return groups;
}

export default function Step1Category({ formData, update, onContinue }) {
  const [error, setError] = useState("");

  const selected = CATEGORIES.find(c => c.key === formData.listing_category);
  const grouped = useMemo(() => (selected ? groupOptions(selected.options) : {}), [selected]);

  const handleContinue = () => {
    if (!formData.listing_category) { setError("Please select a category"); return; }
    if (!formData.category) { setError("Please select a subcategory"); return; }
    setError("");
    onContinue();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">What are you listing?</h2>
        <p className="text-muted-foreground text-sm mt-1">Choose the category that best fits your listing</p>
      </div>

      <div className="space-y-3">
        {CATEGORIES.map(cat => {
          const isSelected = formData.listing_category === cat.key;
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => {
                update("listing_category", cat.key);
                update("category", "");
                update("type", cat.key);
                update("detail", {});
              }}
              className={cn(
                "w-full text-left p-4 rounded-2xl border-2 transition-all relative",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
              )}
            >
              {isSelected && (
                <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-primary" />
              )}
              <div className="flex items-start gap-3.5">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", cat.bg)}>
                  <Icon className={cn("w-6 h-6", cat.color)} strokeWidth={2} />
                </div>
                <div>
                  <p className="font-bold text-base">{cat.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{cat.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div>
          <label htmlFor="listing-subcategory" className="text-sm font-semibold block mb-1">Subcategory *</label>
          <Select value={formData.category || ""} onValueChange={v => update("category", v)}>
            <SelectTrigger id="listing-subcategory" className="h-11 rounded-xl">
              <SelectValue placeholder="Select subcategory..." />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {Object.entries(grouped).map(([groupName, opts]) => (
                <SelectGroup key={groupName}>
                  {selected.key !== "machinery" && <SelectLabel>{groupName}</SelectLabel>}
                  {opts.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.icon ? `${o.icon} ${o.label}` : o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      <StepNav showBack={false} onContinue={handleContinue} />

    </div>
  );
}
