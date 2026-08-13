import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as authService from '@/services/authService';
import { Button } from '@/components/ui/button';
import { ADMIN_NAV_ITEMS, isNavigationItemActive } from '@/lib/navigationConfig';
import BrandLogo from '@/components/BrandLogo';
import { ArrowLeft, ChevronLeft, ChevronRight, LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminSidebarCollapsible({ mobileOpen = false, onMobileOpenChange }) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const mobileCloseRef = useRef(null);

  useEffect(() => { onMobileOpenChange?.(false); }, [location.pathname, onMobileOpenChange]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    mobileCloseRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onMobileOpenChange?.(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onMobileOpenChange]);

  const handleLogout = async () => { await authService.signOut('/'); };
  const nav = (
    <aside className={cn(
      'flex h-full min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
      isCollapsed ? 'sm:w-20' : 'sm:w-64',
      'w-[min(88vw,22rem)]',
    )}>
      <div className="flex min-h-16 items-center justify-between border-b border-sidebar-border px-4 pt-[env(safe-area-inset-top)]">
        <Link to="/admin" aria-label="PeekaListing admin overview"><BrandLogo showWordmark={!isCollapsed} markClassName="h-8 w-8" wordmarkClassName="text-lg" /></Link>
        <button ref={mobileCloseRef} type="button" onClick={() => onMobileOpenChange?.(false)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-sidebar-accent sm:hidden" aria-label="Close admin navigation"><X className="h-5 w-5" /></button>
        <button type="button" onClick={() => setIsCollapsed((value) => !value)} className="hidden h-9 w-9 items-center justify-center rounded-xl hover:bg-sidebar-accent sm:flex" aria-label={isCollapsed ? 'Expand admin navigation' : 'Collapse admin navigation'}>
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Admin navigation">
        <div className="space-y-1">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavigationItemActive(location.pathname, item.path);
            return (
              <Link key={item.path} to={item.path} title={isCollapsed ? item.label : undefined} aria-current={active ? 'page' : undefined} className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
                active ? 'bg-sidebar-accent font-bold text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                isCollapsed && 'sm:justify-center sm:px-0',
              )}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn('truncate', isCollapsed && 'sm:hidden')}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button asChild variant="ghost" className={cn('w-full justify-start text-sidebar-foreground/75 hover:bg-sidebar-accent/60', isCollapsed && 'sm:justify-center sm:px-0')}>
          <Link to="/"><ArrowLeft className="h-4 w-4 shrink-0" /><span className={cn(isCollapsed && 'sm:hidden')}>Back to app</span></Link>
        </Button>
        <Button onClick={handleLogout} variant="ghost" className={cn('w-full justify-start text-sidebar-foreground/75 hover:bg-sidebar-accent/60', isCollapsed && 'sm:justify-center sm:px-0')}>
          <LogOut className="h-4 w-4 shrink-0" /><span className={cn(isCollapsed && 'sm:hidden')}>Sign out</span>
        </Button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="sticky top-0 hidden h-[100dvh] shrink-0 sm:block">{nav}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] sm:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button type="button" className="absolute inset-0 bg-black/70" onClick={() => onMobileOpenChange?.(false)} aria-label="Close admin navigation" />
          <div className="relative h-[100dvh]">{nav}</div>
        </div>
      )}
    </>
  );
}
