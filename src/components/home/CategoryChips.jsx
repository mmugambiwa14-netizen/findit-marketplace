import { Link } from "react-router-dom";
import { BriefcaseBusiness, Building2, Car, Tractor } from "lucide-react";

const CATEGORIES = [
  { label: "Property", icon: Building2, path: "/search?type=property" },
  { label: "Vehicles", icon: Car, path: "/search?type=car" },
  { label: "Machinery", icon: Tractor, path: "/search?type=machinery" },
  { label: "Services", icon: BriefcaseBusiness, path: "/services" },
];

export default function CategoryChips() {
  return (
    <nav className="mx-auto max-w-7xl px-4 py-7 sm:py-9" aria-label="Marketplace categories">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORIES.map(({ label, icon: Icon, path }) => (
          <Link
            key={label}
            to={path}
            className="group flex min-h-20 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-foreground">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
