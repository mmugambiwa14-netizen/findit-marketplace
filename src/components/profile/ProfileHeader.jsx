import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Mail, Pencil, Phone, UserRound } from 'lucide-react';
import { getOwnerListingsCount } from '@/services/ownerListingsService';

export default function ProfileHeader({ user }) {
  const { data: listingsCount = 0 } = useQuery({
    queryKey: ['my-listings-count', user?.id],
    queryFn: () => getOwnerListingsCount(user.id),
    enabled: Boolean(user?.id),
  });

  const avatarUrl = user?.avatar_url || null;
  const initial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <section className="mx-4 mt-4 overflow-hidden rounded-[1.75rem] border border-border/80 bg-card/86 shadow-[0_18px_42px_hsl(var(--clay-shadow-dark)/.35)]">
      <div className="relative bg-[radial-gradient(circle_at_12%_0%,hsl(var(--primary)/.22),transparent_48%),linear-gradient(145deg,hsl(var(--surface-raised)/.72),hsl(var(--card)))] px-5 pb-5 pt-6">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-primary/30 bg-primary/15 text-2xl font-black text-primary shadow-[inset_0_1px_rgba(255,255,255,.12),0_12px_28px_hsl(var(--primary)/.2)]">
            {avatarUrl ? <img src={avatarUrl} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" /> : initial || <UserRound className="h-9 w-9" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-black tracking-tight">{user?.full_name || 'FindIt user'}</h1>
              {user?.phone_verified && <CheckCircle2 className="h-4 w-4 shrink-0 fill-primary text-background" aria-label="Verified phone" />}
            </div>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5 shrink-0" />{user?.email}</p>
            {user?.phone && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5" />{user.phone}{!user.phone_verified && <span className="text-warning">· unverified</span>}</p>}
          </div>
        </div>

        {user?.bio && <p className="mt-4 text-sm leading-6 text-muted-foreground">{user.bio}</p>}

        <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="locked-control rounded-2xl px-4 py-3">
            <p className="text-xl font-black text-primary">{Number(listingsCount).toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">Active and previous listings</p>
          </div>
          <Link to="/settings" className="clay-button flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold"><Pencil className="h-4 w-4" />Edit</Link>
        </div>
      </div>
    </section>
  );
}
