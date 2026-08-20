import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import AdminSessionBoundary from '@/components/admin/AdminSessionBoundary';
import AdminSidebarCollapsible from '@/components/admin/AdminSidebarCollapsible';
import BrandLogo from '@/components/BrandLogo';
import BackButton from '@/components/layout/BackButton';
import SiteFooter from '@/components/layout/SiteFooter';

export default function AdminLayout() {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <AdminSessionBoundary>
      <div className="flex min-h-[100dvh] bg-background">
        <AdminSidebarCollapsible mobileOpen={mobileNavigationOpen} onMobileOpenChange={setMobileNavigationOpen} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex min-h-14 items-center gap-3 border-b border-border bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:hidden">
            <BackButton className="h-10 w-10 border border-border" fallback="/profile" label="Back to profile" />
            <button type="button" onClick={() => setMobileNavigationOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border" aria-label="Open admin navigation">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <BrandLogo markClassName="h-7 w-7" wordmarkClassName="text-base" />
            <span className="ml-auto rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-destructive">Admin</span>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="admin-surface min-h-full"><Outlet /></div>
            <SiteFooter compact />
          </div>
        </div>
      </div>
    </AdminSessionBoundary>
  );
}
