import { ExternalLink, RotateCcw, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AdminMobileList, AdminMobileRecord } from '@/components/admin/AdminMobileRecord';

function maskEmail(value) {
  const [local = '', domain = ''] = String(value || '').split('@');
  if (!domain) return 'Email unavailable';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'•'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function maskPhone(value) {
  const phone = String(value || '').trim();
  if (!phone) return '—';
  const suffix = phone.replace(/\D/g, '').slice(-3);
  return suffix ? `••••••${suffix}` : 'Phone on file';
}

export default function UsersTable({ users, currentUserId, onStatusChange, onBan, isUpdating }) {
  return (
    <>
      <AdminMobileList label="User accounts">
        {users.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">No users match these filters.</Card>
        ) : users.map((user) => (
          <AdminMobileRecord
            key={user.user_id}
            heading={<Link to={`/seller/${encodeURIComponent(user.user_id)}`} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 hover:text-primary hover:underline"><span className="truncate">{user.full_name || 'Unnamed user'}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></Link>}
            summary={`ID ${String(user.user_id).slice(0, 8)}…`}
            badges={<><Badge variant={user.role === 'admin' ? 'default' : 'outline'}>{user.role === 'admin' ? 'Founder admin' : 'User'}</Badge><Badge variant={user.status === 'active' ? 'default' : 'destructive'}>{user.status}</Badge></>}
            fields={[
              { label: 'Email', value: maskEmail(user.email), wide: true },
              { label: 'Phone', value: maskPhone(user.phone) },
              { label: 'Joined', value: new Date(user.created_at).toLocaleDateString() },
              { label: 'Products', value: user.listing_count },
              { label: 'Services', value: user.service_count },
            ]}
            actions={<UserActions user={user} currentUserId={currentUserId} onStatusChange={onStatusChange} onBan={onBan} isUpdating={isUpdating} mobile />}
          />
        ))}
      </AdminMobileList>
      <Card className="hidden overflow-hidden md:block">
      <div className="overflow-x-auto">
        <table className="admin-data-table w-full min-w-[900px] text-sm">
          <thead><tr className="border-b bg-muted/30 text-left"><th className="p-3">User</th><th className="p-3">Contact</th><th className="p-3">Adverts</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Joined</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {users.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No users match these filters.</td></tr> : users.map((user) => (
              <tr key={user.user_id} className="border-b last:border-0">
                <td className="p-3"><Link to={`/seller/${encodeURIComponent(user.user_id)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-primary hover:underline">{user.full_name || 'Unnamed user'}<ExternalLink className="h-3 w-3" /></Link><p className="text-xs text-muted-foreground">ID {String(user.user_id).slice(0, 8)}…</p></td>
                <td className="p-3"><p>{maskEmail(user.email)}</p><p className="text-xs text-muted-foreground">{maskPhone(user.phone)}</p></td>
                <td className="p-3">{user.listing_count} products · {user.service_count} services</td>
                <td className="p-3"><Badge variant={user.role === 'admin' ? 'default' : 'outline'}>{user.role === 'admin' ? 'Founder admin' : 'User'}</Badge></td>
                <td className="p-3"><Badge variant={user.status === 'active' ? 'default' : 'destructive'}>{user.status}</Badge></td>
                <td className="p-3 text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="p-3"><UserActions user={user} currentUserId={currentUserId} onStatusChange={onStatusChange} onBan={onBan} isUpdating={isUpdating} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Card>
    </>
  );
}

function UserActions({ user, currentUserId, onStatusChange, onBan, isUpdating, mobile = false }) {
  if (user.user_id === currentUserId) return <span className="text-xs text-muted-foreground">Current account</span>;
  if (user.status !== 'active') {
    return <Button className={mobile ? 'min-h-11 flex-1' : undefined} size="sm" variant="outline" disabled={isUpdating} onClick={() => onStatusChange({ user, status: 'active' })}><RotateCcw className="mr-1 h-3.5 w-3.5" />Restore</Button>;
  }
  return <><Button className={mobile ? 'min-h-11 flex-1' : undefined} size="sm" variant="outline" disabled={isUpdating} onClick={() => onStatusChange({ user, status: 'suspended' })}><ShieldAlert className="mr-1 h-3.5 w-3.5" />Suspend</Button><Button className={mobile ? 'min-h-11 flex-1' : undefined} size="sm" variant="destructive" disabled={isUpdating} onClick={() => onBan(user)}>Ban</Button></>;
}
