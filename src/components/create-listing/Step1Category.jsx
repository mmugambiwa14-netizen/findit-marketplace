import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Building2, Car, Tractor, Wrench } from "lucide-react";
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
  {
    key: "service",
    icon: Wrench,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-500/10",
    label: "Services",
    desc: "Mechanics, property professionals, builders, surveyors and equipment specialists",
    options: null,
  },
];

function groupOptions(options) {
  const groups = {};
  options.forEach((option) => {
    const group = option.group || "All";
    if (!groups[group]) groups[group] = [];
    groups[group].push(option);
  });
  return groups;
}

export default function Step1Category({ formData, update, onContinue }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const selected = CATEGORIES.find((category) => category.key === formData.listing_category);
  const grouped = useMemo(() => (selected?.options ? groupOptions(selected.options) : {}), [selected]);

  const handleContinue = () => {
    if (!formData.listing_category) { setError("Please select a category"); return; }
    if (!formData.category) { setError("Please select a subcategory"); return; }
    setError("");
    onContinue();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">What are you posting?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose an asset category or offer a professional service</p>
      </div>

      <div className="space-y-3">
        {CATEGORIES.map((category) => {
          const isSelected = formData.listing_category === category.key;
          const Icon = category.icon;
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => {
                if (category.key === "service") {
                  setError("");
                  navigate("/create-service");
                  return;
                }
                update("listing_category", category.key);
                update("category", "");
                update("type", category.key);
                update("detail", {});
              }}
              className={cn(
                "relative w-full rounded-2xl border-2 p-4 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:shadow-sm",
              )}
            >
              {isSelected && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-primary" />}
              <div className="flex items-start gap-3.5">
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", category.bg)}>
                  <Icon className={cn("h-6 w-6", category.color)} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold">{category.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{category.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected?.options && (
        <div>
          <label htmlFor="listing-subcategory" className="mb-1 block text-sm font-semibold">Subcategory *</label>
          <Select value={formData.category || ""} onValueChange={(value) => update("category", value)}>
            <SelectTrigger id="listing-subcategory" className="h-11 rounded-xl">
              <SelectValue placeholder="Select subcategory..." />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {Object.entries(grouped).map(([groupName, options]) => (
                <SelectGroup key={groupName}>
                  {selected.key !== "machinery" && <SelectLabel>{groupName}</SelectLabel>}
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.icon ? `${option.icon} ${option.label}` : option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <StepNav showBack={false} onContinue={handleContinue} />
    </div>
  );
}
