import { Children, isValidElement, useId, useMemo, useState } from 'react';
import { ExternalLink, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { cn } from '@/lib/utils';
import SearchResultsMap from '@/components/search/SearchResultsMap';

const TABS = [
  { id: 'listing-info', label: 'Details' },
  { id: 'description', label: 'Description' },
  { id: 'location', label: 'Location' },
  { id: 'seller', label: 'Seller' },
];

function childId(child) {
  if (!isValidElement(child)) return null;
  const props = /** @type {{ id?: unknown }} */ (child.props);
  return typeof props.id === 'string' && props.id ? props.id : null;
}

function childTitle(child) {
  if (!isValidElement(child)) return null;
  const props = /** @type {{ title?: unknown }} */ (child.props);
  return typeof props.title === 'string' && props.title.trim() ? props.title.trim() : null;
}

export function ListingDetailTabs({ children }) {
  const tabRootId = useId().replaceAll(':', '');
  const allChildren = useMemo(() => Children.toArray(children), [children]);
  const panelChildren = useMemo(() => allChildren.filter((child) => childId(child)), [allChildren]);
  const supplementalChildren = useMemo(() => allChildren.filter((child) => !childId(child)), [allChildren]);
  const availableTabs = useMemo(() => TABS
    .map((tab) => {
      const panel = panelChildren.find((child) => childId(child) === tab.id);
      return panel ? { ...tab, label: childTitle(panel) || tab.label } : null;
    })
    .filter(Boolean), [panelChildren]);
  const [active, setActive] = useState(availableTabs[0]?.id || TABS[0].id);
  const activeTab = availableTabs.find((tab) => tab.id === active) || availableTabs[0] || TABS[0];
  const activePanel = panelChildren.find((child) => childId(child) === activeTab.id) || panelChildren[0] || null;
  const animatedTabs = useMemo(() => availableTabs.map((tab) => ({
    value: tab.id,
    label: tab.label,
    id: `${tabRootId}-tab-${tab.id}`,
    controls: `${tabRootId}-panel-${tab.id}`,
  })), [availableTabs, tabRootId]);

  const selectTab = (id) => {
    if (availableTabs.some((tab) => tab.id === id)) setActive(id);
  };

  return (
    <>
      <nav className="px-3 py-2 md:px-5" aria-label="Listing details">
        <AnimatedTabs
          value={activeTab.id}
          onValueChange={selectTab}
          tabs={animatedTabs}
          ariaLabel="Listing detail sections"
          semantics="tabs"
          className="mx-auto max-w-4xl bg-card/90"
          tabClassName="min-w-[7rem] text-xs sm:min-w-0 sm:text-sm"
        />
      </nav>
      <div className="mx-auto max-w-4xl px-4 pb-8 pt-5 sm:px-6 sm:pb-10 sm:pt-7">
        {activePanel && (
          <div
            id={`${tabRootId}-panel-${activeTab.id}`}
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={`${tabRootId}-tab-${activeTab.id}`}
            className="outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {activePanel}
          </div>
        )}
        {supplementalChildren.length > 0 && <div className="mt-8 space-y-6">{supplementalChildren}</div>}
      </div>
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
      <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">About this listing</p>
          <p className="mt-1 text-xs text-muted-foreground">The seller’s own description and important context.</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">Description</span>
      </div>
      <div className="pt-4">
      {description ? (
        <>
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">{shown}</p>
          {isLong && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-4 min-h-10 rounded-xl px-1 text-sm font-bold text-primary">{expanded ? 'Read less' : 'Read more'}</button>}
        </>
      ) : <p className="text-sm text-muted-foreground">The seller did not add a description.</p>}
      </div>
    </div>
  );
}

export function ListingLocation({ label, latitude, longitude, approximate = false, listingType = 'property' }) {
  const hasCoordinates = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const query = useMemo(() => {
    if (hasCoordinates) return `${Number(latitude)},${Number(longitude)}`;
    return String(label || '').trim();
  }, [hasCoordinates, label, latitude, longitude]);
  const mapsUrl = query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
  const mapListing = useMemo(() => ({
    id: 'listing-location-preview',
    title: label || 'Listing location',
    city: label || '',
    location_name: label || '',
    latitude: hasCoordinates ? Number(latitude) : null,
    longitude: hasCoordinates ? Number(longitude) : null,
    _type: listingType,
  }), [hasCoordinates, label, latitude, listingType, longitude]);

  return (
    <div className="overflow-hidden rounded-3xl border border-border/80 bg-card/90 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 p-4 sm:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Where it is</p>
          <p className="mt-1 text-sm font-bold">{label || 'Location not supplied'}</p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-bold text-primary">Zimbabwe</span>
      </div>
      <SearchResultsMap
        listings={[mapListing]}
        type={listingType}
        compact
        showResultsList={false}
        showSummary={false}
        showPopups={false}
        allowEmptyMap
        ariaLabel={`Map showing ${label || 'listing location'}`}
      />
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Public location</p>
          <p className="mt-1 truncate font-bold">{label || 'Location not supplied'}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{approximate || !hasCoordinates ? 'The map shows an approximate public area, not a seller’s private live location.' : 'The map shows the public listing area, not a seller’s private live location.'}</p>
        </div>
        {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition hover:border-primary/40 hover:bg-primary/8"><ExternalLink className="h-4 w-4" />Open in Google Maps</a>}
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
  roleLabel = 'Seller',
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
  const hasActiveListingCount = resolvedActiveListingCount !== null
    && resolvedActiveListingCount !== undefined
    && String(resolvedActiveListingCount).trim() !== ''
    && Number.isFinite(Number(resolvedActiveListingCount));
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
          {hasActiveListingCount && <span>{Number(resolvedActiveListingCount)} active {roleLabel === 'Provider' ? 'services' : 'listings'}</span>}
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
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-5 text-muted-foreground">
        <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
        <p>Keep conversations in PeekaListing until you have verified the item, provider and payment details.</p>
      </div>
    </div>
  );
}
