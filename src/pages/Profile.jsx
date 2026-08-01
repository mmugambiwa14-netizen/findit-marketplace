import { Link } from 'react-router-dom';
import {
  Bell, Building2, ChevronRight, Heart, HelpCircle, LayoutDashboard, ListChecks,
  LogOut, MessageCircle, Settings, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ThemeToggle from '@/components/layout/ThemeToggle';
import { featureFlags } from '@/lib/featureFlags';
import { toast } from 'sonner';

export default function Profile() {
  const { user, isLoadingAuth: isLoading, logout } = useAuth();

  const handleLogout = async () => {
    const signedOut = await logout();
    if (signedOut === false) toast.error('Could not sign out. Check your connection and try again.');
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>;

  const marketplaceLinks = [
    { icon: ListChecks, label: 'My listings', description: 'Manage posts, availability and enquiries', to: '/my-listings' },
    { icon: Heart, label: 'Saved', description: 'Listings you want to revisit', to: '/saved' },
    featureFlags.messaging && { icon: MessageCircle, label: 'Chats', description: 'Private listing conversations', to: '/chats' },
    featureFlags.essentialNotifications && { icon: Bell, label: 'Notifications', description: 'Marketplace and account updates', to: '/notifications' },
    featureFlags.businessProfiles && { icon: Building2, label: 'Business profile', description: 'Manage your public business presence', to: '/business-profiles' },
  ].filter(Boolean);

  const supportLinks = [
    { icon: Settings, label: 'Settings', description: 'Account, privacy and preferences', to: '/settings' },
    { icon: ShieldCheck, label: 'Safety centre', description: 'Safer buying, selling and reporting', to: '/help' },
    { icon: HelpCircle, label: 'Help and support', description: 'Answers and contact support', to: '/help/contact' },
  ];

  return (
    <div className="findit-screen pb-28">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Your FindIt</p><h1 className="mt-1 text-2xl font-black tracking-tight">Profile</h1></div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link to="/settings" aria-label="Open settings" className="clay-icon h-11 w-11"><Settings className="h-5 w-5" /></Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl">
        <ProfileHeader user={user} />

        <ProfileSection title="Marketplace">
          {marketplaceLinks.map((item) => <ProfileLink key={item.to} {...item} />)}
        </ProfileSection>

        <ProfileSection title="Account and support">
          {supportLinks.map((item) => <ProfileLink key={`${item.to}-${item.label}`} {...item} />)}
        </ProfileSection>

        {user?.role === 'admin' && (
          <ProfileSection title="Administration">
            <ProfileLink icon={LayoutDashboard} label="Admin dashboard" description="Moderation, users and marketplace controls" to="/admin" badge="Admin" />
          </ProfileSection>
        )}

        <div className="px-4 pt-2">
          <button type="button" onClick={handleLogout} className="locked-control flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-destructive/25 text-sm font-bold text-destructive hover:bg-destructive/8"><LogOut className="h-4.5 w-4.5" />Log out</button>
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ title, children }) {
  return (
    <section className="px-4 pt-6">
      <h2 className="mb-2 px-1 text-xs font-extrabold uppercase tracking-[0.13em] text-muted-foreground">{title}</h2>
      <div className="clay-card overflow-hidden rounded-2xl divide-y divide-border/70">{children}</div>
    </section>
  );
}

function ProfileLink({ icon: Icon, label, description, to, badge = null }) {
  return (
    <Link to={to} className="group flex min-h-[72px] items-center gap-3 px-4 py-3 transition hover:bg-primary/[0.045]">
      <span className="locked-icon-tile h-10 w-10"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-bold">{label}{badge && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-primary">{badge}</span>}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span></span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
