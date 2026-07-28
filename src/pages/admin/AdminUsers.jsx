import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import BanUserDialog from '@/components/admin/BanUserDialog';
import CursorPager from '@/components/admin/CursorPager';
import UsersTable from '@/components/admin/UsersTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/AuthContext';
import { getAdminUsers, setAdminUserStatus } from '@/services/adminService';
import { useCursorStack } from '@/hooks/useCursorStack';

const PAGE_SIZE = 25;

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const pagination = useCursorStack();
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [banUser, setBanUser] = useState(null);
  const queryClient = useQueryClient();
  const request = { query, role, status, limit: PAGE_SIZE, cursor: pagination.cursor };
  const { data = { items: [], nextCursor: null }, isLoading, error } = useQuery({ queryKey: ['admin-users', request], queryFn: () => getAdminUsers(request) });

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); queryClient.invalidateQueries({ queryKey: ['admin-audit'] }); };
  const statusMutation = useMutation({ mutationFn: setAdminUserStatus, onSuccess: () => { invalidate(); setDecision(null); setReason(''); setBanUser(null); toast.success('User status updated'); }, onError: (failure) => toast.error(failure.message) });
  const openDecision = (next) => { setDecision(next); setReason(''); };

  const confirmDecision = () => {
    statusMutation.mutate({ userId: decision.user.user_id, status: decision.status, reason });
  };

  const confirmBan = ({ userId, duration_days, reason: banReason }) => {
    const banUntil = new Date(Date.now() + duration_days * 86_400_000).toISOString();
    statusMutation.mutate({ userId, status: 'banned', reason: banReason, banUntil });
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
      <div><h1 className="text-3xl font-bold">Users</h1><p className="mt-1 text-muted-foreground">Manage account access. The founder account is the only administrative identity.</p></div>
      <Card><CardContent className="grid gap-3 pt-5 md:grid-cols-3"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Search users" value={query} onChange={(event) => { setQuery(event.target.value); pagination.reset(); }} placeholder="Name or email" /></div><Select value={role} onValueChange={(value) => { setRole(value); pagination.reset(); }}><SelectTrigger aria-label="Filter users by role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem><SelectItem value="user">Users</SelectItem><SelectItem value="admin">Admins</SelectItem></SelectContent></Select><Select value={status} onValueChange={(value) => { setStatus(value); pagination.reset(); }}><SelectTrigger aria-label="Filter users by status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="banned">Banned</SelectItem></SelectContent></Select></CardContent></Card>
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error.message}</p>}
      {isLoading ? <Card className="p-8 text-center text-muted-foreground">Loading users…</Card> : <UsersTable users={data.items} currentUserId={currentUser?.id} onStatusChange={openDecision} onBan={setBanUser} isUpdating={statusMutation.isPending} />}
      <CursorPager pageNumber={pagination.pageNumber} itemCount={data.items.length} itemLabel="users" canGoBack={pagination.canGoBack} canGoForward={Boolean(data.nextCursor)} onBack={pagination.back} onForward={() => pagination.forward(data.nextCursor)} />
    </div>

    <Dialog open={Boolean(decision)} onOpenChange={(open) => !open && setDecision(null)}><DialogContent><DialogHeader><DialogTitle>{`${decision?.status === 'active' ? 'Restore' : 'Suspend'} account`}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{decision?.user.email}</p><div><Label htmlFor="user-action-reason">Reason</Label><Textarea id="user-action-reason" className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} /></div><Button disabled={reason.trim().length < 3 || statusMutation.isPending} onClick={confirmDecision}>Confirm change</Button></DialogContent></Dialog>
    <BanUserDialog open={Boolean(banUser)} onOpenChange={(open) => !open && setBanUser(null)} user={banUser} onConfirm={confirmBan} isLoading={statusMutation.isPending} />
    </div>
  );
}
