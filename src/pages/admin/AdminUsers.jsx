import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Search } from 'lucide-react';
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
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';
import {
  ADMIN_USER_ACTION_CONFIRMATIONS,
  ADMIN_USER_ROLE_OPTIONS,
  ADMIN_USER_STATUS_OPTIONS,
} from '@/services/adminConfig';

const PAGE_SIZE = 25;

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const pagination = useCursorStack();
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [banUser, setBanUser] = useState(null);
  const queryClient = useQueryClient();
  const request = { query: debouncedQuery, role, status, limit: PAGE_SIZE, cursor: pagination.cursor };
  const { data = { items: [], nextCursor: null }, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['admin-users', request],
    queryFn: () => getAdminUsers(request),
    placeholderData: (previous) => previous,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-audit'] });
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
  };
  const statusMutation = useMutation({
    mutationFn: setAdminUserStatus,
    onSuccess: () => {
      invalidate();
      setDecision(null);
      setReason('');
      setConfirmation('');
      setBanUser(null);
      toast.success('User status updated');
    },
    onError: (failure) => toast.error(failure.message),
  });
  const openDecision = (next) => {
    setDecision(next);
    setReason('');
    setConfirmation('');
  };

  const requiredConfirmation = ADMIN_USER_ACTION_CONFIRMATIONS[decision?.status] || ADMIN_USER_ACTION_CONFIRMATIONS.suspended;
  const confirmDecision = () => {
    if (!decision || confirmation.trim().toUpperCase() !== requiredConfirmation) return;
    statusMutation.mutate({ userId: decision.user.user_id, status: decision.status, reason });
  };

  const confirmBan = ({ userId, duration_days, reason: banReason }) => {
    const banUntil = new Date(Date.now() + duration_days * 86_400_000).toISOString();
    statusMutation.mutate({ userId, status: 'banned', reason: banReason, banUntil });
  };

  return (
    <div className="min-h-[100dvh] bg-background p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Users</h1><p className="mt-1 text-muted-foreground">Manage account access. The founder account is the only administrative identity.</p></div>
        {isFetching && !isLoading && <p className="text-xs text-muted-foreground">Refreshing users…</p>}
      </div>
      <Card><CardContent className="grid gap-3 pt-5 md:grid-cols-3"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Search users" value={query} onChange={(event) => { setQuery(event.target.value); pagination.reset(); }} placeholder="Name or email" /></div><Select value={role} onValueChange={(value) => { setRole(value); pagination.reset(); }}><SelectTrigger aria-label="Filter users by role"><SelectValue /></SelectTrigger><SelectContent>{ADMIN_USER_ROLE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={(value) => { setStatus(value); pagination.reset(); }}><SelectTrigger aria-label="Filter users by status"><SelectValue /></SelectTrigger><SelectContent>{ADMIN_USER_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></CardContent></Card>
      {error && <div className="rounded-2xl border border-destructive/25 bg-destructive/8 p-4 text-sm"><p className="font-bold text-destructive">We could not load users.</p><p className="mt-1 text-muted-foreground">Try again. Reference: {error.correlationId || 'unavailable'}</p><Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>Retry</Button></div>}
      {isLoading ? <Card className="p-4"><ListRowsSkeleton rows={7} label="Loading users" /></Card> : <UsersTable users={data.items} currentUserId={currentUser?.id} onStatusChange={openDecision} onBan={setBanUser} isUpdating={statusMutation.isPending} />}
      <CursorPager pageNumber={pagination.pageNumber} itemCount={data.items.length} itemLabel="users" canGoBack={pagination.canGoBack} canGoForward={Boolean(data.nextCursor)} onBack={pagination.back} onForward={() => pagination.forward(data.nextCursor)} />
    </div>

    <Dialog open={Boolean(decision)} onOpenChange={(open) => { if (!open) { setDecision(null); setReason(''); setConfirmation(''); } }}><DialogContent><DialogHeader><DialogTitle>{`${decision?.status === 'active' ? 'Restore' : 'Suspend'} account`}</DialogTitle></DialogHeader><div className="rounded-2xl border border-warning/25 bg-warning/8 p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" /><div className="text-sm"><p className="font-bold">{decision?.status === 'active' ? 'Account access will be restored.' : 'Account access will be blocked immediately.'}</p><p className="mt-1 text-muted-foreground">{decision?.user.full_name || 'This user'} has {Number(decision?.user.listing_count || 0) + Number(decision?.user.service_count || 0)} recorded adverts. The decision and reason will be written to the audit log.</p></div></div></div><p className="text-sm text-muted-foreground">{decision?.user.email}</p><div><Label htmlFor="user-action-reason">Reason</Label><Textarea id="user-action-reason" className="mt-1" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the policy or operational reason" /></div><div><Label htmlFor="user-action-confirmation">Type {requiredConfirmation} to confirm</Label><Input id="user-action-confirmation" className="mt-1 uppercase" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={requiredConfirmation} /></div><Button variant={decision?.status === 'active' ? 'default' : 'destructive'} disabled={reason.trim().length < 3 || confirmation.trim().toUpperCase() !== requiredConfirmation || statusMutation.isPending} onClick={confirmDecision}>{statusMutation.isPending ? 'Saving…' : `Confirm ${decision?.status === 'active' ? 'restore' : 'suspension'}`}</Button></DialogContent></Dialog>
    <BanUserDialog open={Boolean(banUser)} onOpenChange={(open) => !open && setBanUser(null)} user={banUser} onConfirm={confirmBan} isLoading={statusMutation.isPending} />
    </div>
  );
}
