import { Outlet } from 'react-router-dom';
import AdminSidebarCollapsible from '@/components/admin/AdminSidebarCollapsible';
import SiteFooter from '@/components/layout/SiteFooter';

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-background">
      <AdminSidebarCollapsible />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter compact />
      </div>
    </div>
  );
}
