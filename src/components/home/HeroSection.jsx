import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, Car, Tractor, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";

const TABS = [
  { label: "Properties", value: "property", icon: Building2 },
  { label: "Vehicles", value: "car", icon: Car },
  { label: "Machinery", value: "machinery", icon: Tractor },
];

const PLACEHOLDERS = {
  property: "City, suburb, or property type",
  car: "Make, model, or city",
  machinery: "Equipment type, make, or city",
};

export default function HeroSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState("property");
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams({ type });
    if (query.trim()) params.set("q", query.trim());
    navigate(`/search?${params.toString()}`);
  };

  return (
    <section className="border-b border-border bg-card px-4">
      <div className="mx-auto grid max-w-7xl gap-9 py-12 sm:py-16 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-14 lg:py-20">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">A simpler marketplace</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            Find what you need. List what you have.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Discover products and services, compare the details that matter, and contact sellers directly.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-11 rounded-lg px-5">
              <Link to="/post">Post a listing <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            {!user && <GoogleAuthButton className="w-full sm:w-56" label="Sign in with Google" />}
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Browse freely. Contact sellers directly. FindIt does not handle payments.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4 shadow-sm sm:p-5">
          <div className="mb-4">
            <p className="font-bold">What are you looking for?</p>
            <p className="mt-1 text-sm text-muted-foreground">Start broad, then refine the results.</p>
          </div>
        <div className="mb-3 flex rounded-lg bg-muted p-1" aria-label="Search category">
          {TABS.map(({ label, value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors sm:text-sm ${
                type === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={type === value}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-12 rounded-lg bg-card pl-10 pr-3 text-foreground"
              aria-label="Search listings"
              placeholder={PLACEHOLDERS[type]}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSearch()}
            />
          </div>
          <Button
            type="button"
            onClick={handleSearch}
            className="h-12 rounded-lg px-5"
            aria-label="Search"
          >
            <Search className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Link to="/services" className="rounded-full border px-3 py-1.5 hover:border-primary/40 hover:text-foreground">Browse services</Link>
          <Link to="/search?type=property" className="rounded-full border px-3 py-1.5 hover:border-primary/40 hover:text-foreground">Property</Link>
          <Link to="/search?type=car" className="rounded-full border px-3 py-1.5 hover:border-primary/40 hover:text-foreground">Vehicles</Link>
          <Link to="/search?type=machinery" className="rounded-full border px-3 py-1.5 hover:border-primary/40 hover:text-foreground">Machinery</Link>
        </div>
        </div>
      </div>
    </section>
  );
}
