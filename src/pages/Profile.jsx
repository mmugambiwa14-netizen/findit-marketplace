import { Link } from "react-router-dom";
import { Bell, Building2, ChevronRight, Heart, HelpCircle, LayoutDashboard, List, LogOut, MessageCircle, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/AuthContext";
import ProfileHeader from "@/components/profile/ProfileHeader";
import { featureFlags } from "@/lib/featureFlags";
import { toast } from "sonner";

export default function Profile() {
  const { user, isLoadingAuth: isLoading, logout } = useAuth();

  const handleLogout = async () => {
    const signedOut = await logout();
    if (signedOut === false) toast.error("Could not sign out. Check your connection and try again.");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ProfileHeader user={user} />

      <div className="px-4 py-4 space-y-1">
        <ProfileLink icon={List} label="My Listings" to="/my-listings" />
        <ProfileLink icon={Heart} label="Favourites" to="/saved" />
        {featureFlags.messaging && <ProfileLink icon={MessageCircle} label="Chats" to="/chats" />}
        {featureFlags.essentialNotifications && <ProfileLink icon={Bell} label="Notifications" to="/notifications" />}
        {featureFlags.businessProfiles && <ProfileLink icon={Building2} label="Business Profile" to="/business-profiles" />}

        <Separator className="my-3" />

        <ProfileLink icon={Settings} label="Settings" to="/settings" />
        <ProfileLink icon={HelpCircle} label="Help & Safety" to="/help" />
        
        {user?.role === "admin" && (
          <>
            <Separator className="my-3" />
            <ProfileLink icon={LayoutDashboard} label="Admin Dashboard" to="/admin" badge="Admin" />
          </>
        )}
        
        <Separator className="my-3" />

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Log Out</span>
        </button>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   icon: import("react").ComponentType<any>,
 *   label: string,
 *   to: string,
 *   badge?: string,
 *   badgeColor?: "destructive" | "default"
 * }} props
 */
function ProfileLink({ icon: Icon, label, to, badge, badgeColor }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
          <Icon className="w-[18px] h-[18px] text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={2} />
        </div>
        <span className="font-medium text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeColor === "destructive" ? "bg-destructive/20 text-destructive" : "bg-accent/20 text-accent-foreground"}`}>
            {badge}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
