import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export function DetailLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-label="Loading" />
    </div>
  );
}


export function DetailError({ label = "Listing", onRetry }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-bold">We could not load this {label.toLowerCase()}.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again. The item has not been classified as missing.</p>
        <Button type="button" variant="outline" className="mt-5" onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}

export function DetailMissing({ label }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-muted-foreground">
      {label} not found
    </div>
  );
}

export function DetailSection({ title, children }) {
  return (
    <section className="surface-panel p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function SellerPanel({ name, email }) {
  const content = (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Seller</p>
      <p className="mt-1 font-semibold text-foreground">{name || "FindIt seller"}</p>
      <p className="mt-1 text-sm text-muted-foreground">View the seller’s listings and contact details.</p>
    </>
  );
  return email
    ? <Link to={`/seller/${encodeURIComponent(email)}`} className="surface-panel block p-5 transition hover:border-border-strong">{content}</Link>
    : <div className="surface-panel p-5">{content}</div>;
}

export function SafetyPanel({ children }) {
  return (
    <section className="rounded-2xl border border-warning/25 bg-warning/10 p-4">
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 h-5 w-5 flex-none text-warning" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">Safety tip</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
        </div>
      </div>
    </section>
  );
}

export function ContactBar({ children }) {
  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto max-w-4xl">{children}</div>
    </div>
  );
}
