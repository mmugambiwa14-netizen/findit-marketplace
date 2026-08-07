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
      <nav
        className="sticky top-[calc(env(safe-area-inset-top,0px)+3.75rem)] z-30 bg-background/88 px-3 py-2 backdrop-blur-xl md:top-[3.75rem] md:px-5"
        aria-label="Listing sections"
      >
        <div className="no-scrollbar mx-auto flex max-w-4xl overflow-x-auto rounded-2xl border border-border/80 bg-card/90 p-1 shadow-floating">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => goTo(tab.id)}
              aria-current={active === tab.id ? 'page' : undefined}
              className={cn(
                'min-h-11 flex-1 whitespace-nowrap rounded-xl px-3 text-xs font-bold text-muted-foreground transition-colors sm:text-sm',
                active === tab.id && 'bg-primary/12 text-primary shadow-sm',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      <div className="mx-auto max-w-4xl space-y-10 px-4 pb-8 pt-5 sm:px-6 sm:pb-10 sm:pt-7">{children}</div>
    </>
  );
}

export function ListingTabSection({ id, title, children, className = '' }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn('scroll-mt-32', className)}>
      <div className="mb-4 flex items-center gap-3">
        <span className="h-5 w-1 rounded-full bg-primary" aria-hidden="true" />
        <h2 id={`${id}-heading`} className="text-lg font-black tracking-tight sm:text-xl">{title}</h2>
      </div>
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
    <div className="rounded-3xl border border-border/80 bg-card/90 p-5 shadow-sm sm:p-6">
      {description ? (
        <>
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">{shown}</p>
          {isLong && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-4 min-h-10 rounded-xl px-1 text-sm font-bold text-primary">{expanded ? 'Read less' : 'Read more'}</button>}
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
    <div className="overflow-hidden rounded-3xl border border-border/80 bg-card/90 shadow-sm">
      {embedUrl ? (
        <iframe title={`Map showing ${label || 'listing location'}`} src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-64 w-full border-0 sm:h-72" />
      ) : (
        <div className="flex h-52 items-center justify-center bg-muted/30 text-muted-foreground"><MapPin className="mr-2 h-5 w-5" />Location unavailable</div>
      )}
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Public location</p>
          <p className="mt-1 truncate font-bold">{label || 'Location not supplied'}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">The map shows the public listing area, not a seller’s private live location.</p>
        </div>
        {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition hover:border-primary/40 hover:bg-primary/8"><ExternalLink className="h-4 w-4" />Open map</a>}
      </div>
    </div>
  );
}

export function ListingSeller({
  name,
  sellerId,
  avatarUrl = '',
  activeListingCount,
  joinedAt,
  actions,
  profilePath = null,
  profileLabel = 'View listings',
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const listingMetadata = actions?.props?.listing || {};
  const resolvedAvatarUrl = avatarUrl
    || listingMetadata.seller_avatar_url
    || listingMetadata.provider_avatar_url
    || listingMetadata.avatar_url
    || listingMetadata.profile_photo_url
    || '';
  const resolvedJoinedAt = joinedAt
    || listingMetadata.seller_joined_at
    || listingMetadata.provider_joined_at
    || listingMetadata.profile_created_at
    || null;
  const resolvedActiveListingCount = activeListingCount
    ?? listingMetadata.seller_active_listing_count
    ?? listingMetadata.provider_active_listing_count
    ?? null;
  const joined = resolvedJoinedAt ? new Date(resolvedJoinedAt) : null;
  const validJoined = joined && Number.isFinite(joined.getTime());
  const resolvedProfilePath = profilePath || (sellerId ? `/seller/${encodeURIComponent(sellerId)}` : null);
  const profile = (
    <div className="flex items-center gap-4">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted ring-1 ring-border">
        {resolvedAvatarUrl && !avatarFailed
          ? <img src={resolvedAvatarUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setAvatarFailed(true)} />
          : <UserRound className="h-7 w-7 text-muted-foreground" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-black">{name || 'PeekaListing seller'}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {validJoined && <span>Joined {joined.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>}
          {Number.isFinite(Number(resolvedActiveListingCount)) && <span>{Number(resolvedActiveListingCount)} active listings</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="rounded-3xl border border-border/80 bg-card/90 p-5 shadow-sm sm:p-6">
      {resolvedProfilePath ? <Link to={resolvedProfilePath} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{profile}</Link> : profile}
      <div className="mt-5 space-y-3">
        {actions}
        {resolvedProfilePath && (
          <Link to={resolvedProfilePath} className="flex min-h-11 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-bold transition hover:border-primary/45 hover:bg-primary/8">
            {profileLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
