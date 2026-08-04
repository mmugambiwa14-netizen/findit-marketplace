import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, MapPin, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'listing-info', label: 'Listing info' },
  { id: 'description', label: 'Description' },
  { id: 'location', label: 'Location' },
  { id: 'seller', label: 'Seller' },
];

export function ListingDetailTabs({ children }) {
  const [active, setActive] = useState(TABS[0].id);
  const observerRef = useRef(null);

  useEffect(() => {
    observerRef.current?.disconnect();
    const sections = TABS.map(({ id }) => document.getElementById(id)).filter(Boolean);
    if (!sections.length) return undefined;

    observerRef.current = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActive(visible.target.id);
    }, {
      rootMargin: '-28% 0px -58% 0px',
      threshold: [0.05, 0.2, 0.45, 0.7],
    });
    sections.forEach((section) => observerRef.current.observe(section));
    return () => observerRef.current?.disconnect();
  }, []);

  const goTo = (id) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <nav className="sticky top-[var(--findit-header-height,0px)] z-30 border-y border-border bg-background/95 backdrop-blur-xl" aria-label="Listing sections">
        <div className="no-scrollbar mx-auto flex max-w-4xl overflow-x-auto px-3 sm:px-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => goTo(tab.id)}
              aria-current={active === tab.id ? 'page' : undefined}
              className={cn(
                'relative min-h-12 flex-1 whitespace-nowrap px-3 text-sm font-semibold text-muted-foreground transition-colors',
                active === tab.id && 'text-foreground',
              )}
            >
              {tab.label}
              <span className={cn('absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary transition-opacity', active === tab.id ? 'opacity-100' : 'opacity-0')} />
            </button>
          ))}
        </div>
      </nav>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">{children}</div>
    </>
  );
}

export function ListingTabSection({ id, title, children, className }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn('scroll-mt-28', className)}>
      <h2 id={`${id}-heading`} className="mb-4 text-xl font-black tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function ListingDescription({ value }) {
  const [expanded, setExpanded] = useState(false);
  const description = String(value || '').trim();
  const isLong = description.length > 420;
  const shown = !expanded && isLong ? `${description.slice(0, 420).trimEnd()}…` : description;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      {description ? (
        <>
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">{shown}</p>
          {isLong && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-4 text-sm font-bold text-primary">{expanded ? 'Read less' : 'Read more'}</button>}
        </>
      ) : <p className="text-sm text-muted-foreground">The seller did not add a description.</p>}
    </div>
  );
}

export function ListingLocation({ label, latitude, longitude }) {
  const query = useMemo(() => {
    if (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) return `${Number(latitude)},${Number(longitude)}`;
    return String(label || '').trim();
  }, [label, latitude, longitude]);
  const mapsUrl = query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
  const embedUrl = query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {embedUrl ? (
        <iframe title={`Map showing ${label || 'listing location'}`} src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-64 w-full border-0 sm:h-72" />
      ) : (
        <div className="flex h-52 items-center justify-center bg-muted/30 text-muted-foreground"><MapPin className="mr-2 h-5 w-5" />Location unavailable</div>
      )}
      <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Public location</p>
          <p className="mt-1 truncate font-bold">{label || 'Location not supplied'}</p>
          <p className="mt-1 text-xs text-muted-foreground">The map shows the public listing area, not a seller’s private live location.</p>
        </div>
        {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:border-primary"><ExternalLink className="h-4 w-4" />Open map</a>}
      </div>
    </div>
  );
}

export function ListingSeller({ name, sellerId, activeListingCount, joinedAt, actions }) {
  const joined = joinedAt ? new Date(joinedAt) : null;
  const validJoined = joined && Number.isFinite(joined.getTime());
  const profile = (
    <div className="flex items-center gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted"><UserRound className="h-5 w-5 text-muted-foreground" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-black">{name || 'FindIt seller'}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {validJoined && <span>Joined {joined.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>}
          {Number.isFinite(Number(activeListingCount)) && <span>{Number(activeListingCount)} active listings</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      {sellerId ? <Link to={`/seller/${encodeURIComponent(sellerId)}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{profile}</Link> : profile}
      {actions && <div className="mt-5">{actions}</div>}
    </div>
  );
}
