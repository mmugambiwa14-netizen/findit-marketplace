import {
  Home, Building, BedDouble, GraduationCap, Briefcase, Trees, PartyPopper,
  Car, Bike, Truck, Crown, Wrench, Bus,
  HardHat, Tractor, Pickaxe, Factory, Zap, Hammer, Anchor, LayoutGrid,
} from "lucide-react";

// Curated quick-filter chips per listing type. `value` matches the entity `category`.
// `value: ""` is the "All" chip.
const PROPERTY_CHIPS = [
  { value: "", label: "All", icon: LayoutGrid },
  { value: "house_sale", label: "Houses", icon: Home },
  { value: "apartment_rent", label: "Apartments", icon: Building },
  { value: "bnb", label: "B&B", icon: BedDouble },
  { value: "student_room", label: "Student", icon: GraduationCap },
  { value: "office", label: "Office", icon: Briefcase },
  { value: "land_sale", label: "Land", icon: Trees },
  { value: "venue", label: "Venues", icon: PartyPopper },
];

const CAR_CHIPS = [
  { value: "", label: "All", icon: LayoutGrid },
  { value: "cars_sale", label: "Cars", icon: Car },
  { value: "minibus_kombi", label: "Kombis", icon: Bus },
  { value: "motorbike", label: "Motorbikes", icon: Bike },
  { value: "utility", label: "Bakkies", icon: Truck },
  { value: "van", label: "Vans", icon: Truck },
  { value: "luxury_classic", label: "Luxury", icon: Crown },
  { value: "spare_parts", label: "Parts", icon: Wrench },
];

const MACHINERY_CHIPS = [
  { value: "", label: "All", icon: LayoutGrid },
  { value: "heavy_vehicles", label: "Heavy", icon: Truck },
  { value: "construction", label: "Construction", icon: HardHat },
  { value: "agricultural", label: "Agri", icon: Tractor },
  { value: "mining", label: "Mining", icon: Pickaxe },
  { value: "material_handling", label: "Handling", icon: Factory },
  { value: "generators", label: "Generators", icon: Zap },
  { value: "lifting", label: "Lifting", icon: Hammer },
  { value: "boats", label: "Marine", icon: Anchor },
];

const CHIPS_BY_TYPE = {
  property: PROPERTY_CHIPS,
  car: CAR_CHIPS,
  machinery: MACHINERY_CHIPS,
};

export default function CategoryFilterChips({ type, category, onSelect }) {
  const chips = CHIPS_BY_TYPE[type] || [];
  if (!chips.length) return null;

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pt-3">
      {chips.map(({ value, label, icon: Icon }) => {
        const active = (category || "") === value;
        return (
          <button type="button"
            key={value || "all"}
            onClick={() => onSelect(value)}
            className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
            {label}
          </button>
        );
      })}
    </div>
  );
}