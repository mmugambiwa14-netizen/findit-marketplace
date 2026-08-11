import { CirclePlay, CircleUserRound, Compass, MessageCircle, Plus } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import DesignPreview from './DesignPreview';

const NAV_ITEMS = [
  { label: 'Discover', icon: Compass, href: '/design-preview' },
  { label: 'Peeks', icon: CirclePlay, href: '#peekalisting-preview-results-title' },
  { label: 'Chats', icon: MessageCircle, href: '#peekalisting-preview-activity-title' },
  { label: 'Profile', icon: CircleUserRound, href: '#peekalisting-preview-creator-title' },
];

function PreviewNavigation({ mobile = false }) {
  return (
    <nav aria-label={mobile ? 'Preview mobile navigation' : 'Preview navigation'} className={mobile ? 'peekalisting-preview-mobile-nav' : 'peekalisting-preview-desktop-nav'}>
      {NAV_ITEMS.map(({ label, icon: Icon, href }) => (
        <a key={label} href={href} className={label === 'Discover' ? 'is-active' : ''}>
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}

export default function DesignPreviewShell() {
  return (
    <div className="findit-screen min-h-[100dvh]">
      <header className="glass-bar sticky top-0 z-50 hidden border-b px-4 py-2 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5">
          <a href="/design-preview" className="shrink-0" aria-label="PeekaListing design preview"><BrandLogo markClassName="h-8 w-8 sm:h-9 sm:w-9" wordmarkClassName="text-lg sm:text-xl" /></a>
          <PreviewNavigation />
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" className="clay-button inline-flex h-11 items-center gap-1.5 px-4 text-sm font-bold" onClick={() => document.getElementById('peekalisting-preview-title')?.scrollIntoView({ behavior: 'smooth' })}><Plus className="h-4 w-4" />Post</button>
            <a href="#peekalisting-preview-creator-title" className="clay-control inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground"><CircleUserRound className="h-[18px] w-[18px]" /><span className="hidden lg:inline">Profile</span></a>
          </div>
        </div>
      </header>
      <header className="findit-shared-mobile-top-nav safe-area-top sticky top-0 z-50 border-b border-border/75 bg-background/92 px-4 py-3 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex min-h-[36px] max-w-[510px] items-center justify-between"><a href="/design-preview" aria-label="PeekaListing design preview"><BrandLogo className="gap-2" markClassName="h-8 w-8" wordmarkClassName="text-xl" /></a><span className="text-xs font-semibold text-muted-foreground">Preview mode</span></div>
      </header>
      <main id="main-content"><DesignPreview /></main>
      <div className="md:hidden"><PreviewNavigation mobile /></div>
    </div>
  );
}
