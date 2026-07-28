import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Car, Search, Tractor, Video, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PREVIEW_CATEGORIES = [
  { label: 'Property', icon: Building2 },
  { label: 'Vehicles', icon: Car },
  { label: 'Equipment', icon: Tractor },
  { label: 'Services', icon: Wrench },
];

export default function ToursPlaceholder() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="glass-bar sticky top-0 z-40 border-b px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">FindIt Tours</p>
            <h1 className="mt-1 text-xl font-bold">A clearer way to inspect listings</h1>
          </div>
          <Link to="/search" aria-label="Search listings" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-card text-muted-foreground hover:text-foreground">
            <Search className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <main className="page-shell max-w-5xl">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-card px-5 py-10 sm:px-10 sm:py-14">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Video className="h-7 w-7" />
            </div>
            <h2 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">Tours are being prepared</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Tours will remain attached to active marketplace listings. This preview is visible for design acceptance while secure video upload and processing stay disabled.
            </p>
            <Button asChild className="mt-7">
              <Link to="/search">Browse listings <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-muted-foreground">Planned catalogue categories</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PREVIEW_CATEGORIES.map(({ label, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-4">
                <Icon className="h-5 w-5 text-primary" />
                <p className="mt-4 text-sm font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
