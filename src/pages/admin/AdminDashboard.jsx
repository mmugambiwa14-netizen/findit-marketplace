import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, FolderTree, Store, Users } from 'lucide-react';
import AdminOperationalHealth from '@/components/admin/AdminOperationalHealth';
import AdminRecommendationAnalytics from '@/components/admin/AdminRecommendationAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getAdminDashboardStats,
  getAdminOperationalHealth,
  getAdminRecommendationAnalytics,
} from '@/services/adminService';
import { Skeleton } from '@/components/ui/skeleton';

const overviewCards = [
  { key: 'active_listings', label: 'Active listings', icon: Store, path: '/admin/listings' },
  { key: 'active_services', label: 'Active services', icon: Store, path: '/admin/listings?kind=service' },
  { key: 'total_users', label: 'Users', icon: Users, path: '/admin/users' },
  { key: 'pending_reports', label: 'Pending reports', icon: AlertTriangle, path: '/admin/reports' },
];

export default function AdminDashboard() {
  const { data = {}, isLoading, error } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: getAdminDashboardStats,
    refetchInterval: 60_000,
  });
  const operationalHealth = useQuery({
    queryKey: ['admin-operational-health', 24],
    queryFn: () => getAdminOperationalHealth(24),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const recommendationAnalytics = useQuery({
    queryKey: ['admin-recommendation-analytics', 30],
    queryFn: () => getAdminRecommendationAnalytics(30),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Marketplace overview</h1>
          <p className="mt-1 text-muted-foreground">Review what needs attention and take a narrow, auditable action.</p>
        </div>

        {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error.message}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map(({ key, label, icon: Icon, path }) => (
            <Link key={key} to={path}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {isLoading ? <Skeleton className="h-9 w-20" /> : <p className="text-3xl font-bold">{Number(data[key] ?? 0).toLocaleString()}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <AdminOperationalHealth
          data={operationalHealth.data}
          isLoading={operationalHealth.isLoading}
          error={operationalHealth.error}
        />

        <AdminRecommendationAnalytics
          data={recommendationAnalytics.data}
          isLoading={recommendationAnalytics.isLoading}
          error={recommendationAnalytics.error}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Today</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>{isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{data.new_users_today ?? 0}</p>}<p className="mt-1 text-sm text-muted-foreground">New users</p></div>
              <div>{isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{data.new_marketplace_today ?? 0}</p>}<p className="mt-1 text-sm text-muted-foreground">New adverts</p></div>
            </CardContent>
          </Card>
          <Link to="/admin/categories">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div><CardTitle className="text-base">Category vocabulary</CardTitle><p className="mt-1 text-sm text-muted-foreground">Keep discovery labels useful without changing stable identifiers.</p></div>
                <FolderTree className="h-5 w-5 text-primary" />
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
