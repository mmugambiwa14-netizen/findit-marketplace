import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Heart,
  ListFilter,
  MapPin,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import './design-preview.css';

const LISTINGS = [
  {
    id: 'meadowline',
    title: 'Meadowline House',
    location: 'Borrowdale, Harare',
    price: 'US$2,860',
    detail: '3 bd · 2 ba · 124 m²',
    match: '97% match',
    label: 'Top match',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'blue-hour',
    title: 'The Blue Hour',
    location: 'Avondale, Harare',
    price: 'US$1,980',
    detail: '2 bd · 1 ba · 88 m²',
    match: '91% match',
    label: 'New today',
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'terrace-08',
    title: 'Terrace 08',
    location: 'Eastlea, Harare',
    price: 'US$74,000',
    detail: '2 bd · 2 ba · 106 m²',
    match: '89% match',
    label: 'Open view',
    image: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'cedar-house',
    title: 'Cedar House',
    location: 'Mt Pleasant, Harare',
    price: 'US$2,420',
    detail: '3 bd · 1 ba · 112 m²',
    match: '86% match',
    label: 'Quiet street',
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=85',
  },
];

const CHIPS = ['Warm minimal', 'Near water', 'Room to grow'];

function ListingCard({ listing, saved, onToggleSave }) {
  return (
    <article className="peekalisting-preview-card">
      <div className="peekalisting-preview-card-image">
        <img src={listing.image} alt="" loading="lazy" />
        <span className="peekalisting-preview-card-label">{listing.label}</span>
        <button
          type="button"
          className={`peekalisting-preview-save ${saved ? 'is-saved' : ''}`}
          aria-label={saved ? `Remove ${listing.title} from saved listings` : `Save ${listing.title}`}
          onClick={() => onToggleSave(listing.id)}
        >
          <Heart className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="peekalisting-preview-card-body">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3>{listing.title}</h3>
            <p className="peekalisting-preview-location"><MapPin className="h-3.5 w-3.5" />{listing.location}</p>
          </div>
          <span className="peekalisting-preview-match">{listing.match}</span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="peekalisting-preview-price">{listing.price}</p>
            <p className="peekalisting-preview-detail">{listing.detail}</p>
          </div>
          <button type="button" className="peekalisting-preview-view">View <ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </article>
  );
}

function ListingModal({ onClose }) {
  return (
    <div className="peekalisting-preview-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="peekalisting-preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-listing-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="peekalisting-preview-modal-close" aria-label="Close listing form" onClick={onClose}><X className="h-5 w-5" /></button>
        <span className="peekalisting-preview-eyebrow">New listing</span>
        <h2 id="preview-listing-title">Give your place a good peek.</h2>
        <p>A simple first step. Add the essentials and refine the story later.</p>
        <div className="peekalisting-preview-form-grid">
          <label>Listing name<input placeholder="e.g. The Garden Flat" /></label>
          <label>City or neighborhood<input placeholder="e.g. Avondale, Harare" /></label>
          <label>Price<input placeholder="Monthly price" /></label>
          <label>Type<input placeholder="Home, car, service..." /></label>
        </div>
        <button type="button" className="clay-button mt-5 w-full justify-center">Continue <ArrowUpRight className="h-4 w-4" /></button>
      </section>
    </div>
  );
}

export default function DesignPreview() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('For you');
  const [saved, setSaved] = useState(new Set(['blue-hour']));
  const [modalOpen, setModalOpen] = useState(false);

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return LISTINGS;
    return LISTINGS.filter((listing) => `${listing.title} ${listing.location} ${listing.detail}`.toLowerCase().includes(normalizedQuery));
  }, [query]);

  const toggleSave = (id) => {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="peekalisting-preview-page">
      <div className="peekalisting-preview-shell">
        <div className="peekalisting-preview-context">
          <span>Tuesday, 11 August</span><span>/</span><strong>Your daily peek</strong>
        </div>

        <section className="peekalisting-preview-hero" aria-labelledby="peekalisting-preview-title">
          <div className="peekalisting-preview-hero-copy">
            <span className="peekalisting-preview-eyebrow"><Sparkles className="h-3.5 w-3.5" />Curated for your point of view</span>
            <h1 id="peekalisting-preview-title">Find the places worth a closer look.</h1>
            <p>A quieter way to discover homes, vehicles, and services that feel right for your next chapter.</p>
          </div>
          <div className="peekalisting-preview-search-wrap">
            <label className="sr-only" htmlFor="peekalisting-preview-search">Search listings</label>
            <Search className="h-4 w-4" aria-hidden="true" />
            <input id="peekalisting-preview-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search city, neighborhood, or mood" />
            <kbd>⌘ K</kbd>
            <div className="peekalisting-preview-chip-row">
              {CHIPS.map((chip) => <button type="button" key={chip} onClick={() => setQuery(chip.split(' ')[0])}>{chip}</button>)}
            </div>
          </div>
          <div className="peekalisting-preview-stats" aria-label="Marketplace statistics">
            <div><strong>2,480</strong><span>fresh listings</span></div>
            <div><strong>94%</strong><span>verified places</span></div>
            <div><strong>12 min</strong><span>to shortlist</span></div>
          </div>
        </section>

        <section className="peekalisting-preview-results" aria-labelledby="peekalisting-preview-results-title">
          <div className="peekalisting-preview-section-heading">
            <div><span className="peekalisting-preview-eyebrow">Your shortlist</span><h2 id="peekalisting-preview-results-title">A few good places to begin.</h2></div>
            <button type="button" className="clay-button peekalisting-preview-list-button" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />List a place</button>
          </div>
          <div className="peekalisting-preview-toolbar">
            <div className="peekalisting-preview-tabs" role="tablist" aria-label="Listing filters">
              {['For you', 'Near you', 'New today'].map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
            </div>
            <button type="button" className="clay-control inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground"><ListFilter className="h-4 w-4" />More filters</button>
          </div>
          {filteredListings.length > 0 ? <div className="peekalisting-preview-grid">{filteredListings.map((listing) => <ListingCard key={listing.id} listing={listing} saved={saved.has(listing.id)} onToggleSave={toggleSave} />)}</div> : <div className="peekalisting-preview-empty">No preview listings match “{query}”. Try another place or mood.</div>}
        </section>

        <div className="peekalisting-preview-lower-grid">
          <section className="peekalisting-preview-creator-card" aria-labelledby="peekalisting-preview-creator-title">
            <div><span className="peekalisting-preview-eyebrow">Creator corner</span><h2 id="peekalisting-preview-creator-title">Have a place people should see?</h2><p>Turn your photos into a listing people can feel before they visit.</p></div>
            <button type="button" className="clay-button" onClick={() => setModalOpen(true)}>Create a listing <ArrowUpRight className="h-4 w-4" /></button>
          </section>
          <aside className="peekalisting-preview-activity" aria-labelledby="peekalisting-preview-activity-title">
            <div className="flex items-center justify-between gap-4"><span className="peekalisting-preview-eyebrow" id="peekalisting-preview-activity-title">Recent activity</span><TrendingUp className="h-4 w-4 text-primary" /></div>
            <div className="peekalisting-preview-activity-row"><span>AL</span><p><strong>Alex saved The Blue Hour</strong><small>8 min ago</small></p><Check className="h-4 w-4 text-emerald-500" /></div>
            <div className="peekalisting-preview-activity-row"><span>RK</span><p><strong>Riya viewed your collection</strong><small>42 min ago</small></p><Check className="h-4 w-4 text-emerald-500" /></div>
          </aside>
        </div>
      </div>
      {modalOpen && <ListingModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
