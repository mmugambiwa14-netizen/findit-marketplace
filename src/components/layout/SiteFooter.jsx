import { Link } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';

const LEGAL_LINKS = [
  ['/legal/privacy', 'Privacy'],
  ['/legal/data-protection', 'Data protection'],
  ['/legal/terms', 'Terms'],
  ['/legal/cookies', 'Cookies'],
  ['/legal/community-guidelines', 'Community rules'],
];

export default function SiteFooter({ compact = false }) {
  return (
    <footer className={`border-t border-border/70 bg-card/60 ${compact ? 'px-4 py-5' : 'px-4 pb-24 pt-8 md:pb-8'}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center">
          <Link to="/" className="shrink-0" aria-label="FindIt home">
            <BrandLogo markClassName="h-7 w-7" wordmarkClassName="text-base" />
          </Link>
          <span className="ml-2">A simpler marketplace.</span>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Legal and support">
          {LEGAL_LINKS.map(([path, label]) => (
            <Link key={path} to={path} className="hover:text-foreground hover:underline">
              {label}
            </Link>
          ))}
          <Link to="/help" className="hover:text-foreground hover:underline">
            Help &amp; safety
          </Link>
        </nav>
        <p>&copy; {new Date().getFullYear()} FindIt</p>
      </div>
    </footer>
  );
}
