import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import CursorPager from '@/components/admin/CursorPager';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAdminAuditLog } from '@/services/adminService';
import { useCursorStack } from '@/hooks/useCursorStack';

const PAGE_SIZE = 50;

export default function AdminAuditLog() {
  const [query, setQuery] = useState('');
  const [targetType, setTargetType] = useState('all');
  const pagination = useCursorStack();
  const request = { query, targetType, limit: PAGE_SIZE, cursor: pagination.cursor };
  const { data = { items: [], nextCursor: null }, isLoading, error } = useQuery({ queryKey: ['admin-audit', request], queryFn: () => getAdminAuditLog(request) });

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
      <div><h1 className="text-3xl font-bold">Audit log</h1><p className="mt-1 text-muted-foreground">Read-only evidence for privileged marketplace operations.</p></div>
      <Card><CardContent className="grid gap-3 pt-5 md:grid-cols-2"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search audit log" className="pl-9" value={query} onChange={(event) => { setQuery(event.target.value); pagination.reset(); }} placeholder="Admin, action, or reason" /></div><Select value={targetType} onValueChange={(value) => { setTargetType(value); pagination.reset(); }}><SelectTrigger aria-label="Filter audit log by target type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All targets</SelectItem><SelectItem value="user">Users</SelectItem><SelectItem value="property">Property</SelectItem><SelectItem value="car">Vehicles</SelectItem><SelectItem value="machinery">Machinery</SelectItem><SelectItem value="service">Services</SelectItem><SelectItem value="report">Reports</SelectItem><SelectItem value="tour_report">Tour reports</SelectItem><SelectItem value="listing_tour">Tours</SelectItem><SelectItem value="category">Categories</SelectItem></SelectContent></Select></CardContent></Card>
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error.message}</p>}
      <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b bg-muted/30 text-left"><th className="p-3">When</th><th className="p-3">Admin</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Reason</th><th className="p-3">Correlation</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading audit history…</td></tr> : data.items.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No audit events match these filters.</td></tr> : data.items.map((row) => <tr key={row.audit_id} className="border-b last:border-0"><td className="whitespace-nowrap p-3 text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td><td className="p-3">{row.admin_email}</td><td className="p-3 font-medium">{row.action_performed}</td><td className="p-3">{row.target_record_type || '—'}</td><td className="max-w-80 p-3">{row.reason || '—'}</td><td className="p-3 font-mono text-xs text-muted-foreground">{row.correlation_id.slice(0, 8)}</td></tr>)}</tbody></table></div></Card>
      <CursorPager pageNumber={pagination.pageNumber} itemCount={data.items.length} itemLabel="events" canGoBack={pagination.canGoBack} canGoForward={Boolean(data.nextCursor)} onBack={pagination.back} onForward={() => pagination.forward(data.nextCursor)} />
    </div></div>
  );
}
