import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/layout/BackButton";
import { Shield } from "lucide-react";

function DetailStateShell({ children, fallback }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <BackButton className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))]" fallback={fallback} />
      {children}
    </div>
  );
}

export function DetailLoading({ fallback = '/search' }) {
  return (
    <DetailStateShell fallback={fallback}>
      <div role="status" aria-label="Loading listing" className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
    </DetailStateShell>
  );
}

export function DetailError({ label = "Listing", onRetry, fallback = '/search' }) {
  return (
    <DetailStateShell fallback={fallback}>
      <div className="clay-card max-w-sm rounded-2xl p-6 text-center">
        <h1 className="text-xl font-bold">We could not load this {label.toLowerCase()}.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again. We could not confirm whether this item was removed.</p>
        <Button type="button" variant="outline" className="clay-control mt-5" onClick={onRetry}>Try again</Button>
      </div>
    </DetailStateShell>
  );
}

export function DetailMissing({ label }) {
  const fallback = label === 'Service' ? '/services' : '/search';
  return (
    <DetailStateShell fallback={fallback}>
      <div className="clay-card max-w-sm rounded-2xl px-6 py-10">
        <p className="font-semibold">This {label.toLowerCase()} is no longer available.</p>
        <p className="mt-2 text-sm">It may have been removed or is temporarily unavailable.</p>
        <Link to={fallback} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Browse more</Link>
      </div>
    </DetailStateShell>
  );
}

export function DetailSection({ title, children }) {
  return (
    <section className="surface-panel p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function SellerPanel({ name, sellerId }) {
  const content = (
    <>
      <p className="findit-overline">Seller</p>
      <p className="mt-1 font-bold text-foreground">{name || "PeekaListing seller"}</p>
      <p className="mt-1 text-sm text-muted-foreground">View the seller’s listings and contact details.</p>
    </>
  );
  return sellerId
    ? <Link to={`/seller/${encodeURIComponent(sellerId)}`} className="surface-panel block p-5 transition hover:border-primary/20">{content}</Link>
    : <div className="surface-panel p-5">{content}</div>;
}

export function SafetyPanel({ children }) {
  return (
    <section className="rounded-3xl border border-warning/25 bg-warning/8 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-warning/20 bg-warning/12 text-warning shadow-sm">
          <Shield className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-bold">Buy and arrange safely</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
        </div>
      </div>
    </section>
  );
}

export function ContactBar({ children }) {
  if (!children) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-5 md:right-5 md:px-0 md:pb-0">
      <div className="pointer-events-auto mx-auto max-w-4xl rounded-2xl border border-border/80 bg-card/94 p-2 shadow-floating backdrop-blur-2xl md:max-w-none md:rounded-full md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
        {children}
      </div>
    </div>
  );
}
